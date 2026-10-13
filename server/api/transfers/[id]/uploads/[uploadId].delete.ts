import { setupDatabase } from '../../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../../utils/auth'
import { checkOwnDraft, discardUpload, loadUpload, lockUpload } from '../../../../utils/uploads'
import { isUuid, toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// Give up on an unfinished upload.
//
// A transfer will not send while one of its files is still arriving, so an
// upload that is never going to be finished has to be withdrawn. Only an
// unfinished one can be: once the last piece has landed it is a file of the
// transfer like any other.
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
    if (upload.fileId !== null) {
      setResponseStatus(event, 409)
      return { error: 'UPLOAD_COMPLETE' }
    }

    // Not while a piece is being written into it.
    const release = lockUpload(upload.id)
    if (!release) {
      setResponseStatus(event, 409)
      return { error: 'UPLOAD_BUSY' }
    }

    try {
      await discardUpload(db, upload, event)
    } finally {
      release()
    }

    return { success: true }
  } catch (error) {
    logger.error('Cancel upload error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
