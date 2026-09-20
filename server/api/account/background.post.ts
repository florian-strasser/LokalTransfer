import { setupDatabase } from '../../../app/lib/databaseSetup'
import { fail, requireMember } from '../../utils/auth'
import { imageUploadFailure, MAX_BACKGROUND_BYTES, receiveImageUpload } from '../../utils/imageUpload'
import { removeUserFile, userDir } from '../../utils/storage'
import { defaultBackgroundUrl } from '../../utils/userBackground'
import { logger } from '../../utils/logger'

// Set the signed-in member's default background — the image every transfer they
// send carries unless it is given one of its own.
//
// Members only, like a transfer's own background: a guest drops files off and has
// no download page of their own to dress. Each new transfer gets its own copy
// when it is created, so replacing this later changes what the next transfer
// looks like and leaves the ones already sent exactly as they were.
export default defineEventHandler(async (event) => {
  const auth = await requireMember(event)
  if (!auth.ok) return fail(event, auth)

  const dir = userDir(auth.user.id, event)
  if (!dir) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_USER' }
  }

  try {
    const storedName = await receiveImageUpload(event, dir, {
      prefix: 'bg_',
      maxBytes: MAX_BACKGROUND_BYTES
    })

    if (auth.user.backgroundName) {
      await removeUserFile(auth.user.id, auth.user.backgroundName, event)
    }

    await setupDatabase().execute(
      'UPDATE `user` SET `backgroundName` = ?, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
      [storedName, auth.user.id]
    )

    return { data: { background: defaultBackgroundUrl(storedName) } }
  } catch (error) {
    const failure = imageUploadFailure(error)
    if (failure) {
      setResponseStatus(event, failure.status)
      return { error: failure.code }
    }

    logger.error('Default background upload error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
