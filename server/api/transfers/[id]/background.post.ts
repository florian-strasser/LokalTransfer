import type { RowDataPacket } from 'mysql2'
import { createWriteStream, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import Busboy from 'busboy'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireMember } from '../../../utils/auth'
import { detectImageMime } from '../../../utils/images'
import { ensureTransferDir, generateStoredName, removeStoredFile } from '../../../utils/storage'
import { toPositiveInt } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Upload a background image for one transfer, overriding the instance default.
//
// Members only: a guest is dropping files off, not designing a page.
//
// Stored inside the transfer's own directory, so it is removed along with
// everything else when the transfer expires — no separate lifecycle to get wrong.
// The upload is rejected unless its bytes are a real image, both because the
// download page renders it inline and so a failed guess can't leave a
// non-image sitting where an image is expected.

// Backgrounds are decoration and get sent to every visitor of the page, so this
// is capped far below the per-file limit.
const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const auth = await requireMember(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  if (!transferId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_TRANSFER' }
  }

  const db = setupDatabase()
  const [transfers] = await db.execute<RowDataPacket[]>(
    'SELECT id, senderId, status, backgroundName FROM `transfers` WHERE `id` = ?',
    [transferId]
  )
  const transfer = transfers[0]

  if (!transfer || transfer.senderId !== auth.user.id) {
    setResponseStatus(event, 404)
    return { error: 'NOT_FOUND' }
  }

  if (transfer.status !== 'draft') {
    setResponseStatus(event, 409)
    return { error: 'TRANSFER_ALREADY_SENT' }
  }

  const contentType = getRequestHeader(event, 'content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_CONTENT_TYPE' }
  }

  const dir = await ensureTransferDir(transferId, event)

  try {
    const storedName = await new Promise<string>((resolve, reject) => {
      const busboy = Busboy({
        headers: { 'content-type': contentType },
        limits: { fileSize: MAX_BACKGROUND_BYTES, files: 1, fields: 1 }
      })

      // Prefixed so it is obvious on disk that this isn't one of the transfer's
      // actual files.
      const name = `bg_${generateStoredName()}`
      const targetPath = join(dir, name)

      let settled = false
      let sawFile = false

      const failWith = (error: Error) => {
        if (settled) return
        settled = true
        fs.rm(targetPath, { force: true }).catch(() => {}).finally(() => reject(error))
      }

      busboy.on('file', (_field, stream, _info) => {
        sawFile = true

        stream.on('limit', () => {
          stream.destroy()
          failWith(new Error('FILE_TOO_LARGE'))
        })

        pipeline(stream, createWriteStream(targetPath))
          .then(async () => {
            if (settled) return
            if ((stream as NodeJS.ReadableStream & { truncated?: boolean }).truncated) {
              failWith(new Error('FILE_TOO_LARGE'))
              return
            }

            // The decisive check: is this actually an image? Done after writing
            // because the answer comes from the bytes on disk, not the request.
            if (!(await detectImageMime(targetPath))) {
              failWith(new Error('NOT_AN_IMAGE'))
              return
            }

            settled = true
            resolve(name)
          })
          .catch(failWith)
      })

      busboy.on('error', (error: unknown) =>
        failWith(error instanceof Error ? error : new Error(String(error))))
      busboy.on('close', () => {
        if (!settled && !sawFile) failWith(new Error('NO_FILE'))
      })

      event.node.req.on('aborted', () => failWith(new Error('UPLOAD_ABORTED')))
      event.node.req.pipe(busboy)
    })

    // Replacing an earlier background: drop the old file so repeated changes
    // don't accumulate on disk.
    if (transfer.backgroundName) {
      await removeStoredFile(transferId, String(transfer.backgroundName), event)
    }

    await db.execute('UPDATE `transfers` SET `backgroundName` = ? WHERE `id` = ?', [
      storedName,
      transferId
    ])

    return { data: { success: true } }
  } catch (error) {
    const code = error instanceof Error ? error.message : ''

    if (code === 'FILE_TOO_LARGE') {
      setResponseStatus(event, 413)
      return { error: 'BACKGROUND_TOO_LARGE' }
    }
    if (code === 'NOT_AN_IMAGE' || code === 'NO_FILE') {
      setResponseStatus(event, 400)
      return { error: code === 'NO_FILE' ? 'NO_FILE' : 'NOT_AN_IMAGE' }
    }

    logger.error('Background upload error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
