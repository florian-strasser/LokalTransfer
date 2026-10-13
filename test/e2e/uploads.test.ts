import { createHash } from 'node:crypto'
import { request } from 'node:http'
import { fileURLToPath } from 'node:url'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, setup, url } from '@nuxt/test-utils/e2e'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { testServerEnv } from '../setup/testConfig'
import { createTestUser, listStoredFiles, migrateTestDatabase, resetState, type TestUser } from '../setup/db'

// Resumable uploads: a file sent in pieces, any of which can fail and be sent
// again from wherever the server got to.
//
// The claims worth testing are the ones a dropped connection puts in doubt —
// that the file is whole and in order at the end, that what arrived is kept,
// that the server's idea of "how far" is the truth, and that a transfer never
// goes out with a file still missing its tail.

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
  return response.headers.getSetCookie().find(c => c.startsWith('session_token='))!.split(';')[0]!
}

async function createDraft(cookie: string) {
  const result = await $fetch<{ data: { id: number, token: string } }>('/api/transfers', {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: { retentionDays: 7, recipients: [] }
  })
  return result.data
}

interface UploadStatus {
  id: string
  offset: number
  size: number
  complete: boolean
  chunkSize?: number
  file?: { id: number, filename: string, size: number }
}

/** Announce a file. Returns the raw response so a refusal can be asserted on. */
function announce(cookie: string, transferId: number, body: Record<string, unknown>) {
  return fetch(url(`/api/transfers/${transferId}/uploads`), {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

async function startUpload(cookie: string, transferId: number, filename: string, size: number) {
  const response = await announce(cookie, transferId, { filename, size })
  expect(response.status).toBe(200)
  return (await response.json() as { data: UploadStatus }).data
}

/** Send one piece at `offset`. */
function sendPiece(cookie: string, transferId: number, uploadId: string, offset: number, bytes: Uint8Array) {
  return fetch(url(`/api/transfers/${transferId}/uploads/${uploadId}`), {
    method: 'PATCH',
    headers: { cookie, 'Upload-Offset': String(offset), 'Content-Type': 'application/octet-stream' },
    body: bytes as BodyInit
  })
}

async function status(cookie: string, transferId: number, uploadId: string) {
  const response = await fetch(url(`/api/transfers/${transferId}/uploads/${uploadId}`), { headers: { cookie } })
  return { status: response.status, body: await response.json() as { data?: UploadStatus, error?: string } }
}

/** Non-uniform bytes, so a piece written twice, skipped or out of order shows. */
function pattern(size: number): Buffer {
  const bytes = Buffer.alloc(size)
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + (i >> 8)) % 251
  return bytes
}

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

let member: TestUser

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  member = await createTestUser({ name: 'Member', role: 'admin' })
})

describe('resumable uploads', () => {
  it('assembles a file sent in pieces, byte for byte', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const original = pattern(5 * 1024 * 1024 + 123)

    const upload = await startUpload(cookie, draft.id, 'Export_2026_final.zip', original.length)
    expect(upload.offset).toBe(0)
    expect(upload.complete).toBe(false)
    expect(upload.chunkSize, 'the client is told what piece size to use').toBeGreaterThan(0)

    // Three pieces of deliberately different sizes.
    const cuts = [0, 1_500_000, 4_000_000, original.length]
    let last: UploadStatus | undefined
    for (let i = 0; i < cuts.length - 1; i++) {
      const response = await sendPiece(cookie, draft.id, upload.id, cuts[i]!, original.subarray(cuts[i]!, cuts[i + 1]!))
      expect(response.status).toBe(200)
      last = (await response.json() as { data: UploadStatus }).data
      expect(last.offset).toBe(cuts[i + 1])
    }

    expect(last!.complete).toBe(true)
    expect(last!.file).toMatchObject({ filename: 'Export_2026_final.zip', size: original.length })

    // On disk it is an ordinary stored file now: no `.part` left behind.
    const stored = await listStoredFiles(draft.id)
    expect(stored).toHaveLength(1)
    expect(stored[0]).not.toMatch(/\.part$/)

    // And what a recipient downloads is exactly what was sent.
    await $fetch(`/api/transfers/${draft.id}/send`, { method: 'POST', headers: { cookie } })
    const download = await fetch(url(`/api/download/${draft.token}/file/${last!.file!.id}`))
    expect(download.status).toBe(200)
    expect(sha(new Uint8Array(await download.arrayBuffer()))).toBe(sha(original))
  })

  it('accepts a piece only at the end of what has arrived, and says where that is', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const original = pattern(300_000)
    const upload = await startUpload(cookie, draft.id, 'a.bin', original.length)

    expect((await sendPiece(cookie, draft.id, upload.id, 0, original.subarray(0, 100_000))).status).toBe(200)
    expect((await status(cookie, draft.id, upload.id)).body.data).toMatchObject({ offset: 100_000, complete: false })

    // The same piece again, a piece that would leave a gap, one that overlaps.
    for (const wrong of [0, 150_000, 50_000]) {
      const response = await sendPiece(cookie, draft.id, upload.id, wrong, original.subarray(wrong, wrong + 50_000))
      expect(response.status, `offset ${wrong}`).toBe(409)
      expect(await response.json()).toEqual({ error: 'OFFSET_MISMATCH', offset: 100_000 })
    }

    // None of that was written.
    expect((await status(cookie, draft.id, upload.id)).body.data?.offset).toBe(100_000)

    const rest = await sendPiece(cookie, draft.id, upload.id, 100_000, original.subarray(100_000))
    expect((await rest.json() as { data: UploadStatus }).data.complete).toBe(true)
  })

  it('keeps what arrived before the connection dropped, and carries on from there', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const original = pattern(3 * 1024 * 1024)
    const upload = await startUpload(cookie, draft.id, 'big.bin', original.length)

    // A piece announced as the whole file, of which only the first third is
    // sent before the socket is torn down — what a dying connection looks like.
    const sent = 1024 * 1024
    const target = new URL(url(`/api/transfers/${draft.id}/uploads/${upload.id}`))
    await new Promise<void>((resolve) => {
      const req = request({
        method: 'PATCH',
        host: target.hostname,
        port: target.port,
        path: target.pathname,
        headers: {
          cookie,
          'Upload-Offset': '0',
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(original.length)
        }
      })
      req.on('error', () => {})
      req.write(original.subarray(0, sent), async () => {
        // Torn down once the server has written what it was given, so the test
        // is about resuming and not about how fast a disk flushes.
        for (let i = 0; i < 100; i++) {
          if ((await status(cookie, draft.id, upload.id)).body.data?.offset === sent) break
          await new Promise(r => setTimeout(r, 50))
        }
        req.destroy()
        resolve()
      })
    })

    const afterDrop = (await status(cookie, draft.id, upload.id)).body.data!
    expect(afterDrop.complete).toBe(false)
    expect(afterDrop.offset, 'the megabyte that arrived is still there').toBe(sent)

    // The server may still be letting go of the dead request; a client waits
    // and tries again, which is all `UPLOAD_BUSY` asks of it.
    let response = await sendPiece(cookie, draft.id, upload.id, afterDrop.offset, original.subarray(afterDrop.offset))
    for (let i = 0; i < 50 && response.status === 409; i++) {
      expect(await response.json()).toMatchObject({ error: 'UPLOAD_BUSY' })
      await new Promise(r => setTimeout(r, 100))
      response = await sendPiece(cookie, draft.id, upload.id, afterDrop.offset, original.subarray(afterDrop.offset))
    }
    expect(response.status).toBe(200)
    const done = (await response.json() as { data: UploadStatus }).data
    expect(done.complete).toBe(true)

    await $fetch(`/api/transfers/${draft.id}/send`, { method: 'POST', headers: { cookie } })
    const download = await fetch(url(`/api/download/${draft.token}/file/${done.file!.id}`))
    expect(sha(new Uint8Array(await download.arrayBuffer())), 'no byte lost or doubled at the seam').toBe(sha(original))
  })

  it('still knows about an upload whose last reply never arrived', async () => {
    // The piece that completes a file lands, the connection drops before the
    // answer does, and the client asks again. It has to hear "complete".
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const original = pattern(50_000)
    const upload = await startUpload(cookie, draft.id, 'done.bin', original.length)
    await sendPiece(cookie, draft.id, upload.id, 0, original)

    const asked = await status(cookie, draft.id, upload.id)
    expect(asked.status).toBe(200)
    expect(asked.body.data).toMatchObject({ offset: 50_000, complete: true, file: { filename: 'done.bin', size: 50_000 } })

    const again = await sendPiece(cookie, draft.id, upload.id, 0, original)
    expect(again.status).toBe(409)
    expect(await again.json()).toMatchObject({ error: 'OFFSET_MISMATCH', offset: 50_000, complete: true })

    // Sent twice or not, there is one file.
    expect(await listStoredFiles(draft.id)).toHaveLength(1)
  })

  it('completes an empty file without waiting for a piece', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const upload = await startUpload(cookie, draft.id, 'empty.txt', 0)
    expect(upload).toMatchObject({ complete: true, file: { filename: 'empty.txt', size: 0 } })
  })

  it('refuses a file over the limit before anything is sent', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const limit = Number(testServerEnv.NUXT_MAX_FILE_SIZE_MB) * 1024 * 1024

    const response = await announce(cookie, draft.id, { filename: 'huge.bin', size: limit + 1 })
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'FILE_TOO_LARGE' })
    expect(await listStoredFiles(draft.id)).toEqual([])

    for (const size of [-1, 1.5, 'lots', undefined]) {
      expect((await announce(cookie, draft.id, { filename: 'x', size })).status, `size ${size}`).toBe(400)
    }
  })

  it('refuses more bytes than the file was announced to have, and keeps none of them', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const upload = await startUpload(cookie, draft.id, 'small.bin', 1000)
    await sendPiece(cookie, draft.id, upload.id, 0, pattern(600))

    const tooMuch = await sendPiece(cookie, draft.id, upload.id, 600, pattern(401))
    expect(tooMuch.status).toBe(400)
    expect(await tooMuch.json()).toEqual({ error: 'CHUNK_TOO_LARGE', offset: 600 })
    expect((await status(cookie, draft.id, upload.id)).body.data?.offset).toBe(600)
  })

  it('will not send a transfer while one of its files is still arriving', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)

    // One finished file, one stuck half-way.
    const whole = await startUpload(cookie, draft.id, 'whole.bin', 100)
    await sendPiece(cookie, draft.id, whole.id, 0, pattern(100))
    const half = await startUpload(cookie, draft.id, 'half.bin', 1000)
    await sendPiece(cookie, draft.id, half.id, 0, pattern(400))

    const refused = await fetch(url(`/api/transfers/${draft.id}/send`), { method: 'POST', headers: { cookie } })
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: 'UPLOADS_INCOMPLETE' })

    // Withdrawing the unfinished one is what unblocks it — and takes the
    // partial file with it.
    const cancelled = await fetch(url(`/api/transfers/${draft.id}/uploads/${half.id}`), { method: 'DELETE', headers: { cookie } })
    expect(cancelled.status).toBe(200)
    expect(await listStoredFiles(draft.id)).toHaveLength(1)

    const sent = await fetch(url(`/api/transfers/${draft.id}/send`), { method: 'POST', headers: { cookie } })
    expect(sent.status).toBe(200)

    // A finished upload is a file of the transfer; it cannot be withdrawn.
    const tooLate = await fetch(url(`/api/transfers/${draft.id}/uploads/${whole.id}`), { method: 'DELETE', headers: { cookie } })
    expect(tooLate.status).toBe(409)
  })

  it('is closed to everyone but the transfer\'s sender', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const upload = await startUpload(cookie, draft.id, 'mine.bin', 1000)

    const other = await signIn(await createTestUser({ name: 'Someone Else' }))

    expect((await announce(other, draft.id, { filename: 'theirs.bin', size: 10 })).status).toBe(404)
    expect((await sendPiece(other, draft.id, upload.id, 0, pattern(10))).status).toBe(404)
    expect((await status(other, draft.id, upload.id)).status).toBe(404)
    expect((await fetch(url(`/api/transfers/${draft.id}/uploads/${upload.id}`), { method: 'DELETE', headers: { cookie: other } })).status).toBe(404)

    // And without a session at all.
    expect((await fetch(url(`/api/transfers/${draft.id}/uploads/${upload.id}`))).status).toBe(401)

    // Nothing of theirs was written.
    expect((await status(cookie, draft.id, upload.id)).body.data?.offset).toBe(0)
  })

  it('takes a half-arrived file with it when the draft is deleted', async () => {
    const cookie = await signIn(member)
    const draft = await createDraft(cookie)
    const upload = await startUpload(cookie, draft.id, 'abandoned.bin', 1000)
    await sendPiece(cookie, draft.id, upload.id, 0, pattern(400))
    expect(await listStoredFiles(draft.id)).toHaveLength(1)

    await $fetch(`/api/transfers/${draft.id}`, { method: 'DELETE', headers: { cookie } })

    expect(await listStoredFiles(draft.id)).toEqual([])
    const [rows] = await setupDatabase().execute(
      'SELECT COUNT(*) AS count FROM `transfer_uploads` WHERE `transfer` = ?',
      [draft.id]
    ) as [{ count: number }[], unknown]
    expect(Number(rows[0]!.count)).toBe(0)
  })
})
