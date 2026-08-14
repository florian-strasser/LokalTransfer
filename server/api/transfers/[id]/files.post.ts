import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { createWriteStream, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import Busboy from 'busboy'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../utils/auth'
import { ensureTransferDir, generateStoredName } from '../../../utils/storage'
import { cleanString, toPositiveInt } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Upload one file into a draft transfer.
//
// The request body is piped straight to disk with busboy rather than read with
// `readMultipartFormData`, which buffers the whole upload in memory first. For a
// service whose entire job is multi-gigabyte files, that difference is the
// difference between working and running the process out of memory on the first
// real transfer.
//
// One file per request, on purpose: the client gets true per-file progress, a
// failure only costs that one file, and the size limit can be enforced mid-stream
// instead of after everything has already arrived.

interface UploadResult {
  filename: string
  storedName: string
  mimeType: string
  size: number
}

export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  if (!transferId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_TRANSFER' }
  }

  const config = useRuntimeConfig(event)
  const maxFileSize = (Number(config.maxFileSizeMb) || 2048) * 1024 * 1024
  const maxFiles = Number(config.maxFilesPerTransfer) || 50

  const db = setupDatabase()

  const [transfers] = await db.execute<RowDataPacket[]>(
    'SELECT id, senderId, status FROM `transfers` WHERE `id` = ?',
    [transferId]
  )
  const transfer = transfers[0]

  // 404 rather than 403 for someone else's transfer: an authenticated user
  // shouldn't be able to probe which transfer ids exist.
  if (!transfer || transfer.senderId !== auth.user.id) {
    setResponseStatus(event, 404)
    return { error: 'NOT_FOUND' }
  }

  // Once sent, the file list is what the recipient was told they're getting.
  if (transfer.status !== 'draft') {
    setResponseStatus(event, 409)
    return { error: 'TRANSFER_ALREADY_SENT' }
  }

  const [counts] = await db.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM `transfer_files` WHERE `transfer` = ?',
    [transferId]
  )
  if (Number(counts[0]?.count ?? 0) >= maxFiles) {
    setResponseStatus(event, 400)
    return { error: 'TOO_MANY_FILES' }
  }

  const contentType = getRequestHeader(event, 'content-type') || ''
  if (!contentType.includes('multipart/form-data')) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_CONTENT_TYPE' }
  }

  // Cheap pre-check so an oversized upload is refused before a byte is written.
  // Not authoritative — Content-Length can lie, and the streaming limit below is
  // what actually enforces the cap.
  const declaredLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (declaredLength && declaredLength > maxFileSize + 1024 * 1024) {
    setResponseStatus(event, 413)
    return { error: 'FILE_TOO_LARGE' }
  }

  const dir = await ensureTransferDir(transferId, event)

  try {
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const busboy = Busboy({
        headers: { 'content-type': contentType },
        limits: {
          fileSize: maxFileSize,
          files: 1,
          // The only field expected alongside the file is the original name.
          fields: 2,
          fieldSize: 1024
        }
      })

      const storedName = generateStoredName()
      const targetPath = join(dir, storedName)

      let originalName: string | null = null
      let bytesWritten = 0
      let settled = false
      let sawFile = false

      // Any exit path other than success has to take the partial file with it —
      // otherwise a cancelled or oversized upload leaves an orphan on disk that
      // no database row will ever point at, so nothing would clean it up.
      const failWith = (error: Error) => {
        if (settled) return
        settled = true
        fs.rm(targetPath, { force: true })
          .catch(() => {})
          .finally(() => reject(error))
      }

      busboy.on('field', (name, value) => {
        // The browser sends the filename in the part header, but that gets
        // mangled for non-ASCII names in some clients, so the client also sends
        // it as an explicit field and that one wins.
        if (name === 'filename') originalName = value
      })

      busboy.on('file', (_name, stream, info) => {
        sawFile = true
        originalName = originalName || info.filename

        stream.on('data', (chunk: Buffer) => {
          bytesWritten += chunk.length
        })

        // Emitted by busboy the moment the declared limit is passed, so the
        // rest of the upload is abandoned instead of being written out.
        stream.on('limit', () => {
          const error = new Error('FILE_TOO_LARGE')
          stream.destroy()
          failWith(error)
        })

        pipeline(stream, createWriteStream(targetPath))
          .then(() => {
            if (settled) return
            // `truncated` covers the case where the limit fired at the very end
            // of the stream and the pipeline still resolved.
            if ((stream as NodeJS.ReadableStream & { truncated?: boolean }).truncated) {
              failWith(new Error('FILE_TOO_LARGE'))
              return
            }

            const filename = cleanString(originalName, 255) || 'file'
            settled = true
            resolve({
              filename,
              storedName,
              // Content-Type from the browser is a hint, never trusted: it is
              // stored for display and echoed on download only as an
              // attachment, so it can't drive rendering in anyone's browser.
              mimeType: cleanString(info.mimeType, 150) || 'application/octet-stream',
              size: bytesWritten
            })
          })
          .catch(failWith)
      })

      busboy.on('filesLimit', () => failWith(new Error('TOO_MANY_FILES')))
      busboy.on('error', (error: unknown) =>
        failWith(error instanceof Error ? error : new Error(String(error))))
      busboy.on('close', () => {
        if (!settled && !sawFile) failWith(new Error('NO_FILE'))
      })

      // If the client disconnects mid-upload, busboy's `close` may never fire,
      // so the partial file is cleaned up from the request stream instead.
      event.node.req.on('aborted', () => failWith(new Error('UPLOAD_ABORTED')))

      event.node.req.pipe(busboy)
    })

    const [insert] = await db.execute<ResultSetHeader>(
      'INSERT INTO `transfer_files` (`transfer`, `filename`, `storedName`, `mimeType`, `size`) VALUES (?, ?, ?, ?, ?)',
      [transferId, result.filename, result.storedName, result.mimeType, result.size]
    )

    return {
      data: {
        id: Number(insert.insertId),
        filename: result.filename,
        mimeType: result.mimeType,
        size: result.size
      }
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : ''

    if (code === 'FILE_TOO_LARGE') {
      setResponseStatus(event, 413)
      return { error: 'FILE_TOO_LARGE' }
    }
    if (code === 'NO_FILE' || code === 'TOO_MANY_FILES') {
      setResponseStatus(event, 400)
      return { error: code }
    }
    if (code === 'UPLOAD_ABORTED') {
      // The client is already gone; the status is for the log, not for anyone.
      setResponseStatus(event, 499)
      return { error: 'UPLOAD_ABORTED' }
    }

    logger.error('File upload error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
