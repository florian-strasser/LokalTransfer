import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { testServerEnv } from '../setup/testConfig'
import { createTestUser, migrateTestDatabase, resetState, type TestUser } from '../setup/db'

// Password-protected downloads, the guest drop-off flow, and the gallery's inline
// image rendering.
//
// All three are places where the app hands something to a person who has no
// account here, on the strength of a token alone, so the failure modes are the
// interesting part: an unlock that works on the wrong transfer, a guest mailing
// an outsider, a disguised file rendering as markup on this origin.

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

/** Sign a guest in the way the magic-link flow does, and return their cookie. */
async function signInGuest(guest: TestUser): Promise<string> {
  await $fetch('/api/auth/magic-link/request', {
    method: 'POST',
    body: { email: guest.email }
  })

  const db = setupDatabase()
  const [tokens] = await db.execute(
    'SELECT `value` FROM `verification` WHERE `identifier` = ? AND `purpose` = \'magic_link\'',
    [guest.email]
  ) as [{ value: string }[], unknown]

  const response = await fetch(url('/api/auth/magic-link/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: tokens[0]!.value })
  })
  expect(response.status).toBe(200)
  return response.headers.getSetCookie()
    .find(c => c.startsWith('session_token='))!.split(';')[0]!
}

/** Upload one file's bytes into a draft. */
async function upload(cookie: string, transferId: number, name: string, bytes: Uint8Array | string) {
  const form = new FormData()
  form.append('file', new Blob([bytes as BlobPart]), name)
  const response = await fetch(url(`/api/transfers/${transferId}/files`), {
    method: 'POST',
    headers: { cookie },
    body: form
  })
  expect(response.status).toBe(200)
  return await response.json() as { data: { id: number } }
}

/** Create a draft, add one file, send it. */
async function sendTransfer(cookie: string, body: Record<string, unknown>, filename = 'a.txt', bytes: Uint8Array | string = 'contents') {
  const created = await $fetch<{ data: { id: number, token: string } }>('/api/transfers', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: { retentionDays: 7, recipients: [], ...body }
  })
  const file = await upload(cookie, created.data.id, filename, bytes)
  await $fetch(`/api/transfers/${created.data.id}/send`, { method: 'POST', headers: { cookie } })
  return { ...created.data, fileId: file.data.id }
}

let member: TestUser

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  member = await createTestUser({ name: 'Member', role: 'admin' })
})

describe('password-protected transfers', () => {
  it('withholds the file list until the password is given', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(cookie, { password: 'grape', subject: 'Locked' })

    const locked = await $fetch<{ data: Record<string, unknown> }>(
      `/api/download/${transfer.token}`
    )

    // The page has to know a password is needed, and nothing else: no filenames,
    // no sizes, no message.
    expect(locked.data.requiresPassword).toBe(true)
    expect(locked.data.files).toBeUndefined()

    const download = await fetch(url(`/api/download/${transfer.token}/file/${transfer.fileId}`))
    expect(download.status).toBe(403)

    const zip = await fetch(url(`/api/download/${transfer.token}/zip`))
    expect(zip.status).toBe(403)
  })

  it('unlocks with the right password and refuses the wrong one', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(cookie, { password: 'grape' })

    const wrong = await fetch(url(`/api/download/${transfer.token}/unlock`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'banana' })
    })
    expect(wrong.status).toBe(403)
    expect(wrong.headers.getSetCookie().length).toBe(0)

    const right = await fetch(url(`/api/download/${transfer.token}/unlock`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'grape' })
    })
    expect(right.status).toBe(200)

    const unlockCookie = right.headers.getSetCookie()[0]!.split(';')[0]!

    const listing = await $fetch<{ data: { files: unknown[] } }>(
      `/api/download/${transfer.token}`,
      { headers: { cookie: unlockCookie } }
    )
    expect(listing.data.files).toHaveLength(1)

    const download = await fetch(url(`/api/download/${transfer.token}/file/${transfer.fileId}`), {
      headers: { cookie: unlockCookie }
    })
    expect(download.status).toBe(200)
    expect(await download.text()).toBe('contents')
  })

  it('will not let one transfer\'s unlock open another', async () => {
    // The cookie is keyed to the transfer's own password hash, so it cannot be
    // carried across. Without that, unlocking any one protected transfer would
    // unlock every protected transfer on the instance.
    const cookie = await signIn(member)
    const mine = await sendTransfer(cookie, { password: 'grape' })
    const theirs = await sendTransfer(cookie, { password: 'grape' })

    const unlocked = await fetch(url(`/api/download/${mine.token}/unlock`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'grape' })
    })
    const unlockCookie = unlocked.headers.getSetCookie()[0]!.split(';')[0]!

    // Same password, different transfer — still locked.
    const crossed = await fetch(url(`/api/download/${theirs.token}/file/${theirs.fileId}`), {
      headers: { cookie: unlockCookie }
    })
    expect(crossed.status).toBe(403)
  })

  it('stops accepting the password once the transfer expires', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(cookie, { password: 'grape' })

    const db = setupDatabase()
    await db.execute(
      'UPDATE `transfers` SET `expiresAt` = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE `id` = ?',
      [transfer.id]
    )

    const response = await fetch(url(`/api/download/${transfer.token}/unlock`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'grape' })
    })
    expect(response.status).toBe(404)
  })

  it('leaves an unprotected transfer open', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(cookie, {})

    const listing = await $fetch<{ data: Record<string, unknown> }>(
      `/api/download/${transfer.token}`
    )
    expect(listing.data.requiresPassword).toBeFalsy()

    const download = await fetch(url(`/api/download/${transfer.token}/file/${transfer.fileId}`))
    expect(download.status).toBe(200)
  })

  it('rejects a share password shorter than the minimum', async () => {
    const cookie = await signIn(member)
    const response = await fetch(url('/api/transfers'), {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 7, recipients: [], password: 'ab' })
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'INVALID_TRANSFER_PASSWORD' })
  })
})

describe('guest drop-off', () => {
  it('lets a guest send to a chosen team member', async () => {
    const guest = await createTestUser({ type: 'guest', name: 'Agency Client' })
    const cookie = await signInGuest(guest)

    // The picker is filled from this endpoint.
    const recipients = await $fetch<{ data: { id: string, email: string }[] }>(
      '/api/recipients',
      { headers: { cookie } }
    )
    expect(recipients.data.map(r => r.email)).toContain(member.email)

    const created = await $fetch<{ data: { id: number } }>('/api/transfers', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: { recipientUserIds: [recipients.data.find(r => r.email === member.email)!.id] }
    })

    await upload(cookie, created.data.id, 'from-client.txt', 'here you go')
    const sent = await $fetch<{ data: { recipientCount: number } }>(
      `/api/transfers/${created.data.id}/send`,
      { method: 'POST', headers: { cookie } }
    )
    expect(sent.data.recipientCount).toBe(1)

    const db = setupDatabase()
    const [rows] = await db.execute(
      'SELECT `kind`, `retentionDays` FROM `transfers` WHERE `id` = ?',
      [created.data.id]
    ) as [{ kind: string, retentionDays: number }[], unknown]

    expect(rows[0]!.kind).toBe('guest')
    // Guests don't choose retention: an outside contact must not be able to pin
    // something on the server indefinitely.
    expect(rows[0]!.retentionDays).toBe(Number(testServerEnv.NUXT_DEFAULT_RETENTION_DAYS))
  })

  // The restrictions share one guest session on purpose. Magic links are rate
  // limited to five per quarter hour per IP — correctly, since the endpoint mails
  // whoever is named — and every test here comes from 127.0.0.1. Signing in once
  // and making several assertions is both under the limit and closer to what a
  // guest actually does.
  it('confines a guest to dropping files off for a team member', async () => {
    const guest = await createTestUser({ type: 'guest' })
    const otherGuest = await createTestUser({ type: 'guest' })
    const cookie = await signInGuest(guest)

    // Recipients are resolved from ids against the member table, so a guest
    // cannot use the instance as a relay to a third party of their choosing.
    const toOutsider = await fetch(url('/api/transfers'), {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: ['outsider@example.com'], retentionDays: 7 })
    })
    expect(toOutsider.status).toBe(400)
    expect(await toOutsider.json()).toEqual({ error: 'NO_RECIPIENTS' })

    // Nor another guest — only internal members are addressable.
    const toGuest = await fetch(url('/api/transfers'), {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientUserIds: [otherGuest.id] })
    })
    expect(toGuest.status).toBe(400)

    // A guest's session is an ordinary session, so every member-only endpoint
    // has to exclude them explicitly rather than relying on the session check.
    for (const path of ['/api/admin/users', '/api/auth/api-key']) {
      const response = await fetch(url(path), { headers: { cookie } })
      expect(response.status, path).toBe(403)
    }
  })

  it('rate limits magic-link requests', async () => {
    // Five per quarter hour per IP. The endpoint sends mail to whatever address
    // it is given, so an unlimited one is a spam cannon pointed at strangers.
    const guest = await createTestUser({ type: 'guest' })

    const statuses: number[] = []
    for (let i = 0; i < 8; i++) {
      const response = await fetch(url('/api/auth/magic-link/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guest.email })
      })
      statuses.push(response.status)
    }

    expect(statuses).toContain(429)
    // ...and it is a cap, not a block: the early attempts went through.
    expect(statuses[0]).toBe(200)
  })
})

describe('gallery previews', () => {
  // A minimal but genuine 1×1 PNG.
  const PNG = Uint8Array.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ])

  it('renders a real image inline, locked down', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(cookie, { layout: 'gallery' }, 'photo.png', PNG)

    const response = await fetch(url(`/api/download/${transfer.token}/preview/${transfer.fileId}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/png')

    // This is the only endpoint that renders an upload in the browser rather
    // than saving it, so the hardening has to be present on every response.
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toContain('sandbox')
  })

  it('refuses a file that is not really an image, whatever it is called', async () => {
    // The uploader's filename and declared type are ignored entirely; only the
    // leading bytes decide. An HTML file renamed to .png must never render on
    // this origin.
    const cookie = await signIn(member)
    const transfer = await sendTransfer(
      cookie,
      { layout: 'gallery' },
      'disguised.png',
      '<html><script>alert(1)</script></html>'
    )

    const preview = await fetch(url(`/api/download/${transfer.token}/preview/${transfer.fileId}`))
    expect(preview.status).toBe(404)

    // It still downloads normally, as an attachment.
    const download = await fetch(url(`/api/download/${transfer.token}/file/${transfer.fileId}`))
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toContain('application/octet-stream')
  })

  it('will not preview a locked transfer without the password', async () => {
    const cookie = await signIn(member)
    const transfer = await sendTransfer(
      cookie,
      { layout: 'gallery', password: 'grape' },
      'photo.png',
      PNG
    )

    const response = await fetch(url(`/api/download/${transfer.token}/preview/${transfer.fileId}`))
    expect(response.status).toBe(403)
  })
})
