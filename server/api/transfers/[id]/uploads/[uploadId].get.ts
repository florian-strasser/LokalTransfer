import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../../utils/auth'
import { loadUpload, loadUploadedFile, uploadOffset } from '../../../../utils/uploads'
import { isUuid, toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// How far an upload has got.
//
// This is the question a client asks after a connection dropped: the request it
// was sending may have delivered all of its bytes, some of them, or none, and
// the client has no way to know which. The answer is read from the disk.
//
// A finished upload answers `complete` with its file, however long ago it
// finished — the piece that completed it may have arrived while its reply did
// not, and the client has to be able to find that out.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  const uploadId = getRouterParam(event, 'uploadId')
  if (!transferId || !isUuid(uploadId)) {
    setResponseStatus(event, 404)
    return { error: 'NOT_FOUND' }
  }

  try {
    const db = setupDatabase()

    // Ownership through the transfer, and deliberately without the draft check:
    // a client that lost the reply to its last piece may ask after the transfer
    // has been sent by another of its requests.
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT senderId FROM `transfers` WHERE `id` = ?',
      [transferId]
    )
    if (rows[0]?.senderId !== auth.user.id) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const upload = await loadUpload(db, transferId, uploadId)
    if (!upload) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    if (upload.fileId !== null) {
      const file = await loadUploadedFile(db, upload)
      return { data: { id: upload.id, offset: upload.size, size: upload.size, complete: true, file } }
    }

    return {
      data: {
        id: upload.id,
        offset: await uploadOffset(upload, event),
        size: upload.size,
        complete: false
      }
    }
  } catch (error) {
    logger.error('Upload status error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
