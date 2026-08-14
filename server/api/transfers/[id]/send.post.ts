import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../utils/auth'
import { sendTransferById } from '../../../utils/transferActions'
import { toPositiveInt } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Finalise a draft: make it downloadable, start the retention clock, and notify
// everyone involved. The work itself lives in `sendTransferById` so the MCP
// `sendTransfer` tool delivers exactly what this does.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  const transferId = toPositiveInt(getRouterParam(event, 'id'))
  if (!transferId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_TRANSFER' }
  }

  try {
    const db = setupDatabase()
    const result = await sendTransferById(event, db, transferId, auth.user)

    if (!result.ok) {
      const status = result.reason === 'ALREADY_SENT'
        ? 409
        : result.reason === 'NO_FILES' ? 400 : 404
      setResponseStatus(event, status)
      return { error: result.reason === 'ALREADY_SENT' ? 'TRANSFER_ALREADY_SENT' : result.reason }
    }

    return {
      data: {
        id: result.transferId,
        token: result.token,
        status: 'sent',
        expiresAt: result.expiresAt,
        downloadUrl: result.downloadUrl,
        recipientCount: result.recipientCount,
        notified: result.notified
      }
    }
  } catch (error) {
    logger.error('Send transfer error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
