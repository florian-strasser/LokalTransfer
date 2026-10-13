import { createWriteStream, promises as fs } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setupDatabase } from '../../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../../utils/auth'
import { suspendRequestTimeout, UPLOAD_IDLE_TIMEOUT_MS } from '../../../../utils/requestTimeout'
import {
  checkOwnDraft,
  completeUpload,
  loadUpload,
  loadUploadedFile,
  lockUpload,
  partPath,
  uploadOffset
} from '../../../../utils/uploads'
import { isUuid, toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// Append one piece of a file.
//
// The body is the raw bytes, and `Upload-Offset` says where in the file they
// belong. They are only accepted if that is exactly where the file on disk
// ends: a piece is never written anywhere but at the end, so pieces cannot
// overlap, leave a gap or arrive out of order. A client that is unsure where
// the end is — its last request died — is told (`409 OFFSET_MISMATCH` with the
// real offset) and sends from there.
//
// What arrives before a connection drops is kept. That is the whole point: the
// next request carries on from the last byte that made it to disk, not from the
// start of the piece, let alone the start of the file.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  const uploadId = getRouterParam(event, 'uploadId')
  if (!transferId || !isUuid(uploadId)) {
    setResponseStatus(event, 404)
    return { error: 'NOT_FOUND' }
  }

  const declared = Number(getRequestHeader(event, 'upload-offset'))
  if (getRequestHeader(event, 'upload-offset') === undefined || !Number.isSafeInteger(declared) || declared < 0) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_OFFSET' }
  }

  const db = setupDatabase()

  try {
    const draft = await checkOwnDraft(db, transferId, auth.user.id)
    if (!draft.ok) {
      setResponseStatus(event, draft.status)
      return { error: draft.error }
    }

    const upload = await loadUpload(db, transferId, uploadId)
    if (!upload) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    // Already whole: the piece that finished it arrived, even if its reply did
    // not. Said in the same shape as any other wrong offset, with the file.
    if (upload.fileId !== null) {
      setResponseStatus(event, 409)
      return {
        error: 'OFFSET_MISMATCH',
        offset: upload.size,
        complete: true,
        file: await loadUploadedFile(db, upload)
      }
    }

    const release = lockUpload(upload.id)
    if (!release) {
      setResponseStatus(event, 409)
      return { error: 'UPLOAD_BUSY' }
    }

    // A piece is small, but on a slow enough line it can still outlast the time
    // Node allows a request — the same limit as for a whole-file upload.
    const resumeRequestTimeout = suspendRequestTimeout(event)

    try {
      const path = partPath(upload, event)
      if (!path) throw new Error('UPLOAD_PATH_INVALID')

      const offset = await uploadOffset(upload, event)
      if (declared !== offset) {
        setResponseStatus(event, 409)
        return { error: 'OFFSET_MISMATCH', offset }
      }

      const remaining = upload.size - offset

      // Refused up front when the client says how much it is sending; the
      // counter below is what holds for a body that does not say.
      const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
      if (contentLength > remaining) {
        setResponseStatus(event, 400)
        return { error: 'CHUNK_TOO_LARGE', offset }
      }

      let received = 0
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          received += chunk.length
          if (received > remaining) done(new Error('CHUNK_TOO_LARGE'))
          else done(null, chunk)
        }
      })

      // Silence ends a piece early, as it does a whole-file upload.
      event.node.req.setTimeout(UPLOAD_IDLE_TIMEOUT_MS, () => event.node.req.destroy())

      const out = createWriteStream(path, { flags: 'a' })
      let failure: unknown = null
      try {
        await pipeline(event.node.req, limit, out)
      } catch (error) {
        failure = error
      }
      // The offset is read from the file, so the file has to be closed first.
      if (!out.closed) await new Promise<void>(resolve => out.once('close', () => resolve()))

      // More than the file was declared to hold: none of this piece is kept.
      if (failure instanceof Error && failure.message === 'CHUNK_TOO_LARGE') {
        await fs.truncate(path, offset)
        setResponseStatus(event, 400)
        return { error: 'CHUNK_TOO_LARGE', offset }
      }

      const arrived = await uploadOffset(upload, event)

      if (arrived === upload.size) {
        const file = await completeUpload(db, upload, event)
        return { data: { id: upload.id, offset: arrived, size: upload.size, complete: true, file } }
      }

      if (failure) {
        // The client is gone, or went quiet. What it sent stays where it is.
        // The status is for the log, not for anyone.
        setResponseStatus(event, 499)
        return { error: 'UPLOAD_ABORTED', offset: arrived }
      }

      return { data: { id: upload.id, offset: arrived, size: upload.size, complete: false } }
    } finally {
      resumeRequestTimeout()
      release()
    }
  } catch (error) {
    logger.error('Upload piece error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
