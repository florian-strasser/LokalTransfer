import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { hashApiKey } from '../../server/utils/apiKey'
import { testServerEnv } from '../setup/testConfig'
import { createTestUser, migrateTestDatabase, resetState, type TestUser } from '../setup/db'

// API keys are the newest surface and the one with the most authority: a key
// acts as a whole account, over HTTP, forever. The properties below are held in
// place by nothing except the code being right, so they are the ones worth
// pinning — especially the two deliberate narrowings (no administration, no
// minting a second key) and the isolation between accounts.

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  build: true,
  env: testServerEnv
})

async function signIn(user: TestUser): Promise<string> {
  const response = await fetch(url('/api/auth/sign-in'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password })
  })
  expect(response.status).toBe(200)
  return response.headers.getSetCookie()
    .find(c => c.startsWith('session_token='))!.split(';')[0]!
}

interface KeyResponse {
  data: { id: string, key: string, start: string, readOnly: boolean }
}

async function createKey(cookie: string, body: Record<string, unknown> = {}) {
  const result = await $fetch<KeyResponse>('/api/auth/api-key', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: { name: 'Test key', ...body }
  })
  return result.data
}

/** Raw fetch so a non-2xx status is a value rather than a thrown error. */
async function request(path: string, init: RequestInit = {}) {
  return await fetch(url(path), init)
}

let admin: TestUser
let other: TestUser

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  admin = await createTestUser({ name: 'Admin', role: 'admin' })
  other = await createTestUser({ name: 'Other Member', role: 'user' })
})

describe('creating keys', () => {
  it('returns the plaintext once and stores only a hash', async () => {
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    expect(key.key).toMatch(/^[0-9a-f]{64}$/)
    expect(key.start).toBe(key.key.slice(0, 8))

    const db = setupDatabase()
    const [rows] = await db.execute(
      'SELECT `key` FROM `apikey` WHERE `id` = ?',
      [key.id]
    ) as [{ key: string }[], unknown]

    // A leaked database must be useless for impersonation.
    expect(rows[0]!.key).not.toBe(key.key)
    expect(rows[0]!.key).toBe(hashApiKey(key.key))
  })

  it('never lists the key again', async () => {
    const cookie = await signIn(admin)
    const created = await createKey(cookie)

    const listed = await $fetch<{ data: Record<string, unknown>[] }>('/api/auth/api-key', {
      headers: { cookie }
    })

    const row = listed.data.find(k => k.id === created.id)!
    expect(row.start).toBe(created.start)
    expect(JSON.stringify(row)).not.toContain(created.key)
  })

  it('refuses a scope list, rather than silently granting write', async () => {
    // Guessing the field name wrong must not fail open: `permissions` is not the
    // contract, `readOnly` is, and ignoring it would hand back a full key to a
    // caller who believed they had asked for a restricted one.
    const cookie = await signIn(admin)

    const response = await request('/api/auth/api-key', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sneaky', permissions: ['read'] })
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'USE_READ_ONLY_FLAG' })
  })

  it('requires a name', async () => {
    const cookie = await signIn(admin)
    const response = await request('/api/auth/api-key', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' })
    })
    expect(response.status).toBe(400)
  })

  it('will not let a key mint another key', async () => {
    // Otherwise one leaked read-only key could bootstrap itself into a permanent
    // write one, and revoking the original would achieve nothing.
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    const response = await request('/api/auth/api-key', {
      method: 'POST',
      headers: { 'x-api-key': key.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Second generation' })
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'API_KEY_CANNOT_MANAGE_KEYS' })
  })

  it('rejects an expiry beyond a year', async () => {
    const cookie = await signIn(admin)
    const response = await request('/api/auth/api-key', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Forever', expiresInDays: 400 })
    })
    expect(response.status).toBe(400)
  })
})

describe('authenticating with a key', () => {
  it('acts as the account that created it', async () => {
    const cookie = await signIn(other)
    const key = await createKey(cookie)

    const listing = await $fetch<{ data: { sent: unknown[], received: unknown[] } }>(
      '/api/transfers',
      { headers: { 'x-api-key': key.key } }
    )
    expect(listing.data.sent).toEqual([])
  })

  it('refuses a malformed, unknown or revoked key', async () => {
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    for (const candidate of ['nonsense', '', 'f'.repeat(63), '0'.repeat(64)]) {
      const response = await request('/api/transfers', {
        headers: { 'x-api-key': candidate }
      })
      expect(response.status, candidate || '(empty)').toBe(401)
    }

    // Revocation takes effect on the very next request.
    await $fetch(`/api/auth/api-key/${key.id}`, { method: 'DELETE', headers: { cookie } })
    const afterRevoke = await request('/api/transfers', { headers: { 'x-api-key': key.key } })
    expect(afterRevoke.status).toBe(401)
  })

  it('refuses an expired key', async () => {
    const cookie = await signIn(admin)
    const key = await createKey(cookie, { expiresInDays: 1 })

    const db = setupDatabase()
    await db.execute(
      'UPDATE `apikey` SET `expiresAt` = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE `id` = ?',
      [key.id]
    )

    const response = await request('/api/transfers', { headers: { 'x-api-key': key.key } })
    expect(response.status).toBe(401)
  })

  it('refuses a key whose owner is banned', async () => {
    const cookie = await signIn(other)
    const key = await createKey(cookie)

    const db = setupDatabase()
    await db.execute('UPDATE `user` SET `banned` = 1 WHERE `id` = ?', [other.id])

    const response = await request('/api/transfers', { headers: { 'x-api-key': key.key } })
    expect(response.status).toBe(401)
  })

  it('records when it was last used', async () => {
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    await request('/api/transfers', { headers: { 'x-api-key': key.key } })

    // Written fire-and-forget, so allow it a moment to land.
    await new Promise(resolve => setTimeout(resolve, 300))

    const db = setupDatabase()
    const [rows] = await db.execute(
      'SELECT `lastUsedAt` FROM `apikey` WHERE `id` = ?',
      [key.id]
    ) as [{ lastUsedAt: Date | null }[], unknown]
    expect(rows[0]!.lastUsedAt).not.toBeNull()
  })
})

describe('read-only scope', () => {
  it('allows reads and refuses every write', async () => {
    const cookie = await signIn(admin)
    const readOnly = await createKey(cookie, { name: 'Reader', readOnly: true })
    expect(readOnly.readOnly).toBe(true)

    const listing = await request('/api/transfers', { headers: { 'x-api-key': readOnly.key } })
    expect(listing.status).toBe(200)

    const create = await request('/api/transfers', {
      method: 'POST',
      headers: { 'x-api-key': readOnly.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 1, recipients: [] })
    })
    expect(create.status).toBe(403)
    expect(await create.json()).toEqual({ error: 'API_KEY_READ_ONLY' })

    const remove = await request('/api/transfers/1', {
      method: 'DELETE',
      headers: { 'x-api-key': readOnly.key }
    })
    expect(remove.status).toBe(403)
  })

  it('lets a full key write', async () => {
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    const created = await $fetch<{ data: { id: number } }>('/api/transfers', {
      method: 'POST',
      headers: { 'x-api-key': key.key, 'Content-Type': 'application/json' },
      body: { retentionDays: 1, recipients: [] }
    })
    expect(created.data.id).toBeGreaterThan(0)
  })
})

describe('administration is closed to keys', () => {
  it('refuses an admin endpoint even for an admin\'s key', async () => {
    // The one place the API is deliberately narrower than the UI: a long-lived
    // credential in a CI config should not be able to delete a user, which takes
    // every transfer they ever sent with them.
    const cookie = await signIn(admin)
    const key = await createKey(cookie)

    const response = await request('/api/admin/users', { headers: { 'x-api-key': key.key } })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'API_KEY_CANNOT_ADMINISTER' })
  })

  it('still allows the same admin through the browser session', async () => {
    const cookie = await signIn(admin)
    const response = await request('/api/admin/users', { headers: { cookie } })
    expect(response.status).toBe(200)
  })

  it('refuses a non-admin member outright', async () => {
    const cookie = await signIn(other)
    const response = await request('/api/admin/users', { headers: { cookie } })
    expect(response.status).toBe(403)
  })
})

describe('isolation between accounts', () => {
  it('cannot see, send or delete another member\'s transfer', async () => {
    const adminCookie = await signIn(admin)
    const adminKey = await createKey(adminCookie)
    const created = await $fetch<{ data: { id: number } }>('/api/transfers', {
      method: 'POST',
      headers: { 'x-api-key': adminKey.key, 'Content-Type': 'application/json' },
      body: { retentionDays: 1, recipients: [], subject: 'Private' }
    })

    const otherCookie = await signIn(other)
    const otherKey = await createKey(otherCookie)

    // 404 rather than 403 throughout, so ids cannot be probed for existence.
    for (const [method, path] of [
      ['POST', `/api/transfers/${created.data.id}/send`],
      ['DELETE', `/api/transfers/${created.data.id}`]
    ] as const) {
      const response = await request(path, {
        method,
        headers: { 'x-api-key': otherKey.key }
      })
      expect(response.status, `${method} ${path}`).toBe(404)
    }

    const listing = await $fetch<{ data: { sent: unknown[], received: unknown[] } }>(
      '/api/transfers',
      { headers: { 'x-api-key': otherKey.key } }
    )
    // Someone else's transfer appears on neither side of the caller's list.
    expect(listing.data.sent).toEqual([])
    expect(listing.data.received).toEqual([])
  })

  it('cannot revoke another member\'s key', async () => {
    const adminCookie = await signIn(admin)
    const adminKey = await createKey(adminCookie)

    const otherCookie = await signIn(other)
    const response = await request(`/api/auth/api-key/${adminKey.id}`, {
      method: 'DELETE',
      headers: { cookie: otherCookie }
    })
    expect(response.status).toBe(404)

    // Still works, so the failed revocation really was a no-op.
    const stillValid = await request('/api/transfers', { headers: { 'x-api-key': adminKey.key } })
    expect(stillValid.status).toBe(200)
  })

  it('lists only the caller\'s own keys', async () => {
    const adminCookie = await signIn(admin)
    await createKey(adminCookie, { name: 'Admin key' })

    const otherCookie = await signIn(other)
    await createKey(otherCookie, { name: 'Other key' })

    const listed = await $fetch<{ data: { name: string }[] }>('/api/auth/api-key', {
      headers: { cookie: otherCookie }
    })
    expect(listed.data.map(k => k.name)).toEqual(['Other key'])
  })
})

describe('user deletion', () => {
  it('takes the account\'s keys with it', async () => {
    const adminCookie = await signIn(admin)
    const otherCookie = await signIn(other)
    const doomed = await createKey(otherCookie)

    await $fetch(`/api/admin/users/${other.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie }
    })

    const db = setupDatabase()
    const [rows] = await db.execute(
      'SELECT `id` FROM `apikey` WHERE `userId` = ?',
      [other.id]
    ) as [unknown[], unknown]
    expect(rows).toHaveLength(0)

    const response = await request('/api/transfers', { headers: { 'x-api-key': doomed.key } })
    expect(response.status).toBe(401)
  })
})
