import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireMember } from '../../../utils/auth'
import { imageUploadFailure, MAX_BACKGROUND_BYTES, receiveImageUpload } from '../../../utils/imageUpload'
import { removeStoredFile, transferDir } from '../../../utils/storage'
import { toPositiveInt } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Upload a background image for one transfer, replacing whatever it had — the
// member's default, copied in when the draft was created, or an earlier upload.
//
// Members only: a guest is dropping files off, not designing a page.
//
// Stored inside the transfer's own directory, so it is removed along with
// everything else when the transfer expires — no separate lifecycle to get wrong.
// The upload is rejected unless its bytes are a real image, both because the
// download page renders it inline and so a failed guess can't leave a
// non-image sitting where an image is expected.
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

  try {
    const storedName = await receiveImageUpload(event, transferDir(transferId, event), {
      prefix: 'bg_',
      maxBytes: MAX_BACKGROUND_BYTES
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
    const failure = imageUploadFailure(error)
    if (failure) {
      setResponseStatus(event, failure.status)
      return { error: failure.code }
    }

    logger.error('Background upload error', error)
    setResponseStatus(event, 500)
    return { error: 'UPLOAD_FAILED' }
  }
})
