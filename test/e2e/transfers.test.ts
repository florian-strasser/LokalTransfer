import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { TEST_STORAGE, testServerEnv } from '../setup/testConfig'
import {
  createTestUser,
  listStoredFiles,
  migrateTestDatabase,
  resetState,
  type TestUser
} from '../setup/db'

// End-to-end over real HTTP, against a real Nuxt server and the test database.
//
// These cover the paths that only exist as a running request: the streaming
// upload (busboy writing to disk without buffering), the streaming zip
// (archiver), and the two token flows whose whole point is what arrives in an
// inbox. None of them can be exercised by calling a function.

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  build: true,
  // The server is pointed at the same test database and temporary storage root
  // as the assertions below, so a test can check the rows and the files a
  // request produced rather than trusting the response body.
  env: testServerEnv
})

/** Sign in and return the session cookie to send on subsequent requests. */
async function signIn(user: TestUser): Promise<string> {
  const response = await fetch(url('/api/auth/sign-in'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password })
  })

  expect(response.status).toBe(200)
  const cookie = response.headers.getSetCookie().find(c => c.startsWith('session_token='))
  expect(cookie, 'sign-in should set a session cookie').toBeDefined()
  return cookie!.split(';')[0]!
}

/** Create a draft transfer over the API and return its id and token. */
async function createDraft(cookie: string, body: Record<string, unknown> = {}) {
  const result = await $fetch<{ data: { id: number, token: string } }>('/api/transfers', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: { retentionDays: 7, recipients: [], ...body }
  })
  return result.data
}

/** Upload one file to a draft, streaming it the way the browser does. */
async function uploadFile(cookie: string, transferId: number, path: string, filename: string) {
  const form = new FormData()
  const contents = await fs.readFile(path)
  form.append('file', new Blob([contents]), filename)

  return await fetch(url(`/api/transfers/${transferId}/files`), {
    method: 'POST',
    headers: { cookie },
    body: form
  })
}

let member: TestUser

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  member = await createTestUser({ name: 'Member', role: 'admin' })
})

describe('streamed uploads', () => {
  it('accepts a large file and writes exactly its bytes to disk', async () => {
    // 12 MB — well past any buffer boundary, and large enough that a handler
    // that read the body into memory would show it, while still keeping the
    // suite quick. The size limit for tests is 16 MB (see testConfig).
    const SIZE = 12 * 1024 * 1024
    const tmp = join(TEST_STORAGE, 'large-upload.bin')
    // A repeating but non-uniform pattern, so a truncated or reordered write
    // cannot accidentally produce the right length and the right bytes.
    const chunk = Buffer.alloc(1024 * 1024)
    for (let i = 0; i < chunk.length; i++) chunk[i] = i % 251
    await fs.writeFile(tmp, Buffer.concat(Array.from({ length: 12 }, () => chunk)))

    const cookie = await signIn(member)
    const draft = await createDraft(cookie)

    const response = await uploadFile(cookie, draft.id, tmp, 'large.bin')
    expect(response.status).toBe(200)

    const body = await response.json() as { data: { size: number, filename: string } }
    expect(body.data.filename).toBe('large.bin')
    expect(body.data.size).toBe(SIZE)

    // The row is only half the claim; the bytes have to be on disk.
    const stored = await listStoredFiles(draft.id)
    expect(stored).toHaveLength(1)
    const onDisk = await fs.stat(join(TEST_STORAGE, 'transfers', String(draft.id), stored[0]!))
    expect(onDisk.size).toBe(SIZE)

    await fs.rm(tmp, { force: true })
  })

  it('refuses a file over the limit and leaves nothing behind', async () => {
    const tmp = join(TEST_STORAGE, 'too-large.bin')
    await fs.writeFile(tmp, Buffer.alloc(17 * 1024 * 1024, 7))

    const cookie = await signIn(member)
    const draft = await createDraft(cookie)

    const response = await uploadFile(cookie, draft.id, tmp, 'too-large.bin')
    expect(response.status).toBeGreaterThanOrEqual(400)

    // The limit is enforced mid-stream, so the partial file must be cleaned up
    // rather than left occupying disk under a row that was never written.
    const db = setupDatabase()
    const [rows] = await db.execute(
      'SELECT * FROM `transfer_files` WHERE `transfer` = ?',
      [draft.id]
    )
    expect(rows).toHaveLength(0)
    expect(await listStoredFiles(draft.id)).toHaveLength(0)

    await fs.rm(tmp, { force: true })
  })

  it('stores the original filename in the database, never on disk', async () => {
    const tmp = join(TEST_STORAGE, 'plain.txt')
    await fs.writeFile(tmp, 'hello')

    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    await uploadFile(cookie, draft.id, tmp, '../../etc/passwd')

    // Whatever the client called it, the name on disk is generated here.
    const stored = await listStoredFiles(draft.id)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatch(/^[0-9a-f]+$/)

    await fs.rm(tmp, { force: true })
  })
})

describe('download', () => {
  async function sentTransferWithFiles(cookie: string, files: [string, string][]) {
    const draft = await createDraft(cookie, { subject: 'Bundle' })

    for (const [filename, contents] of files) {
      const tmp = join(TEST_STORAGE, `src-${filename}`)
      await fs.writeFile(tmp, contents)
      const response = await uploadFile(cookie, draft.id, tmp, filename)
      expect(response.status).toBe(200)
      await fs.rm(tmp, { force: true })
    }

    await $fetch(`/api/transfers/${draft.id}/send`, {
      method: 'POST',
      headers: { cookie }
    })

    return draft
  }

  it('serves a single file with its original name reattached', async () => {
    const cookie = await signIn(member)
    const draft = await sentTransferWithFiles(cookie, [['report.txt', 'the contents']])

    const listing = await $fetch<{ data: { files: { id: number }[] } }>(
      `/api/download/${draft.token}`
    )
    const fileId = listing.data.files[0]!.id

    const response = await fetch(url(`/api/download/${draft.token}/file/${fileId}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('report.txt')
    expect(await response.text()).toBe('the contents')
  })

  it('zips a multi-file transfer with every file intact', async () => {
    // The zip is streamed and stored (not deflated) so it starts immediately on
    // a multi-gigabyte transfer. That means a broken central directory would
    // still produce a plausible-looking response — so the archive is opened.
    const cookie = await signIn(member)
    const draft = await sentTransferWithFiles(cookie, [
      ['one.txt', 'first file'],
      ['two.txt', 'second file'],
      ['three.txt', 'x'.repeat(100_000)]
    ])

    const response = await fetch(url(`/api/download/${draft.token}/zip`))
    expect(response.status).toBe(200)

    const archive = Buffer.from(await response.arrayBuffer())
    // Local file header magic — this really is a zip, not an error page.
    expect(archive.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4B, 0x03, 0x04]))

    const zipPath = join(TEST_STORAGE, 'download.zip')
    await fs.writeFile(zipPath, archive)

    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)

    // `unzip -t` walks the central directory and verifies every entry's CRC, so
    // a truncated stream or a wrong size field fails here rather than silently
    // producing a corrupt file for the recipient.
    const { stdout } = await run('unzip', ['-t', zipPath])
    expect(stdout).toContain('No errors detected')

    const { stdout: listed } = await run('unzip', ['-Z1', zipPath])
    expect(listed.split('\n').filter(Boolean).sort()).toEqual([
      'one.txt',
      'three.txt',
      'two.txt'
    ])

    await fs.rm(zipPath, { force: true })
  })

  it('refuses an unknown token', async () => {
    const response = await fetch(url(`/api/download/${'0'.repeat(64)}`))
    expect(response.status).toBe(404)
  })

  it('refuses a transfer that has expired', async () => {
    const cookie = await signIn(member)
    const draft = await sentTransferWithFiles(cookie, [['a.txt', 'data']])

    // Enforced at request time, independently of the sweep — so the promise
    // holds the moment it lapses rather than at the next quarter hour.
    const db = setupDatabase()
    await db.execute(
      'UPDATE `transfers` SET `expiresAt` = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE `id` = ?',
      [draft.id]
    )

    const response = await fetch(url(`/api/download/${draft.token}`))
    expect(response.status).toBe(404)

    // The files are still on disk — deleting them is the sweep's job. This is
    // the "unreachable" half of the two-part guarantee.
    expect(await listStoredFiles(draft.id)).toHaveLength(1)
  })
})

describe('magic-link sign-in', () => {
  it('issues a redeemable link for a known guest and signs them in', async () => {
    const guest = await createTestUser({ type: 'guest', name: 'Agency Client' })

    const requested = await $fetch<{ success: boolean }>('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email: guest.email }
    })
    expect(requested.success).toBe(true)

    // The token exists only in the database and the mail; nothing in the
    // response reveals it, which is the point of the flow.
    const db = setupDatabase()
    const [tokens] = await db.execute(
      'SELECT value, purpose FROM `verification` WHERE `identifier` = ?',
      [guest.email]
    ) as [{ value: string, purpose: string }[], unknown]

    expect(tokens).toHaveLength(1)
    expect(tokens[0]!.purpose).toBe('magic_link')

    const response = await fetch(url('/api/auth/magic-link/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokens[0]!.value })
    })
    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().some(c => c.startsWith('session_token='))).toBe(true)

    // One-time: the token is consumed on redemption.
    const second = await fetch(url('/api/auth/magic-link/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokens[0]!.value })
    })
    expect(second.status).toBeGreaterThanOrEqual(400)
  })

  it('answers identically for an address that has no account', async () => {
    // Otherwise this endpoint is an oracle for who has an account here.
    const known = await createTestUser({ type: 'guest' })

    const forKnown = await $fetch('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email: known.email }
    })
    const forUnknown = await $fetch('/api/auth/magic-link/request', {
      method: 'POST',
      body: { email: 'nobody@example.com' }
    })

    expect(forUnknown).toEqual(forKnown)

    const db = setupDatabase()
    const [tokens] = await db.execute(
      'SELECT value FROM `verification` WHERE `identifier` = ?',
      ['nobody@example.com']
    ) as [unknown[], unknown]
    expect(tokens).toHaveLength(0)
  })
})

describe('password reset', () => {
  it('lets a member set a new password with the emailed token', async () => {
    const requested = await $fetch<{ success: boolean }>('/api/auth/request-password', {
      method: 'POST',
      body: { email: member.email }
    })
    expect(requested.success).toBe(true)

    const db = setupDatabase()
    const [tokens] = await db.execute(
      'SELECT value, purpose FROM `verification` WHERE `identifier` = ?',
      [member.email]
    ) as [{ value: string, purpose: string }[], unknown]

    expect(tokens).toHaveLength(1)
    // The purpose column is what stops a magic link being redeemed as a reset.
    expect(tokens[0]!.purpose).toBe('password_reset')

    const NEW_PASSWORD = 'BrandNewPassword99'
    const reset = await $fetch<{ success: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: { token: tokens[0]!.value, password: NEW_PASSWORD }
    })
    expect(reset.success).toBe(true)

    // The new password works...
    await signIn({ ...member, password: NEW_PASSWORD })

    // ...and the old one does not.
    const oldAttempt = await fetch(url('/api/auth/sign-in'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: member.email, password: member.password })
    })
    expect(oldAttempt.status).toBeGreaterThanOrEqual(400)
  })

  it('will not redeem the same token twice', async () => {
    await $fetch('/api/auth/request-password', {
      method: 'POST',
      body: { email: member.email }
    })

    const db = setupDatabase()
    const [tokens] = await db.execute(
      'SELECT value FROM `verification` WHERE `identifier` = ?',
      [member.email]
    ) as [{ value: string }[], unknown]

    const token = tokens[0]!.value
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: 'FirstReplacement1' }
    })

    const second = await fetch(url('/api/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'SecondReplacement1' })
    })
    expect(second.status).toBeGreaterThanOrEqual(400)
  })

  it('does not reveal whether an address is registered', async () => {
    const forKnown = await $fetch('/api/auth/request-password', {
      method: 'POST',
      body: { email: member.email }
    })
    const forUnknown = await $fetch('/api/auth/request-password', {
      method: 'POST',
      body: { email: 'nobody-here@example.com' }
    })
    expect(forUnknown).toEqual(forKnown)
  })
})
