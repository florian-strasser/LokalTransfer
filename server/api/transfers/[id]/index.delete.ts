import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../../utils/auth'
import { deleteTransfers } from '../../../utils/transfers'
import { toPositiveInt } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Revoke a transfer early — the manual version of expiry. Files go from disk and
// the rows go with them, so any link already in someone's inbox stops working.
//
// Admins can delete anyone's transfer; everyone else only their own.
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
    const [transfers] = await db.execute<RowDataPacket[]>(
      'SELECT id, senderId FROM `transfers` WHERE `id` = ?',
      [transferId]
    )
    const transfer = transfers[0]

    const isOwner = transfer && transfer.senderId === auth.user.id
    const isAdmin = auth.user.role === 'admin' && auth.user.type === 'member'

    if (!transfer || (!isOwner && !isAdmin)) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    await deleteTransfers(db, [transferId], event)

    return { success: true }
  } catch (error) {
    logger.error('Delete transfer error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
