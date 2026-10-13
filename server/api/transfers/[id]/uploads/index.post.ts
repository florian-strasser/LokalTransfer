import { promises as fs } from 'node:fs'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../../utils/auth'
import { ensureTransferDir, generateStoredName } from '../../../../utils/storage'
import {
  UPLOAD_CHUNK_SIZE,
  checkOwnDraft,
  completeUpload,
  countFileSlots,
  loadUpload,
  partPath
} from '../../../../utils/uploads'
import { cleanString, toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// Announce a file that will arrive in pieces.
//
// Nothing is uploaded here: the client says what is coming — a name and a size —
// and gets back the id to send the pieces to. Declaring the size first is what
// lets the limit be refused before a byte has been sent, and what tells the
// server which piece is the last one.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  if (!transferId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_TRANSFER' }
  }

  try {
    const config = useRuntimeConfig(event)
    const maxFileSize = (Number(config.maxFileSizeMb) || 2048) * 1024 * 1024
    const maxFiles = Number(config.maxFilesPerTransfer) || 50

    const body = await readBody(event)

    const size = Number(body?.size)
    if (!Number.isSafeInteger(size) || size < 0) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_SIZE' }
    }
    if (size > maxFileSize) {
      setResponseStatus(event, 413)
      return { error: 'FILE_TOO_LARGE' }
    }

    const db = setupDatabase()

    const draft = await checkOwnDraft(db, transferId, auth.user.id)
    if (!draft.ok) {
      setResponseStatus(event, draft.status)
      return { error: draft.error }
    }

    if (await countFileSlots(db, transferId) >= maxFiles) {
      setResponseStatus(event, 400)
      return { error: 'TOO_MANY_FILES' }
    }

    const id = uuidv4()
    const storedName = generateStoredName()
    // The name is stored for display and for the download header, never used on
    // disk; the type is a hint from the client, echoed only as an attachment.
    const filename = cleanString(body?.filename, 255) || 'file'
    const mimeType = cleanString(body?.mimeType, 150) || 'application/octet-stream'

    await ensureTransferDir(transferId, event)
    await db.execute(
      'INSERT INTO `transfer_uploads` (`id`, `transfer`, `filename`, `storedName`, `mimeType`, `size`) VALUES (?, ?, ?, ?, ?, ?)',
      [id, transferId, filename, storedName, mimeType, size]
    )

    const upload = (await loadUpload(db, transferId, id))!
    // The empty part file exists from the start, so "how far along is it" has
    // one answer — the file's size — from the first moment on.
    await fs.writeFile(partPath(upload, event)!, '')

    // An empty file has no pieces to wait for.
    if (size === 0) {
      const file = await completeUpload(db, upload, event)
      return { data: { id, offset: 0, size, chunkSize: UPLOAD_CHUNK_SIZE, complete: true, file } }
    }

    return { data: { id, offset: 0, size, chunkSize: UPLOAD_CHUNK_SIZE, complete: false } }
  } catch (error) {
    logger.error('Create upload error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
