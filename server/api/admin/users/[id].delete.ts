import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireAdmin } from '../../../utils/auth'
import { deleteTransfers } from '../../../utils/transfers'
import { logger } from '../../../utils/logger'

// Remove an account and everything it put on the server.
//
// Deleting the user's transfers is the point rather than a side effect: if an
// account is being removed because the person left or the relationship ended,
// leaving their uploads downloadable by anyone still holding a link would defeat
// the exercise.
export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event)
  if (!auth.ok) return fail(event, auth)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_USER' }
  }

  // Deleting yourself would drop your own session mid-request and, if you were
  // the only admin, leave the instance with no way into user management.
  if (userId === auth.user.id) {
    setResponseStatus(event, 400)
    return { error: 'CANNOT_DELETE_SELF' }
  }

  try {
    const db = setupDatabase()

    const [existing] = await db.execute<RowDataPacket[]>('SELECT id FROM `user` WHERE `id` = ?', [userId])
    if (existing.length === 0) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const [transfers] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM `transfers` WHERE `senderId` = ?',
      [userId]
    )
    await deleteTransfers(db, transfers.map((row: RowDataPacket) => Number(row.id)), event)

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute('DELETE FROM `session` WHERE `userId` = ?', [userId])
      await conn.execute('DELETE FROM `account` WHERE `userId` = ?', [userId])
      // API keys go with the account. A key whose user is gone already fails to
      // authenticate, so this isn't closing a hole — it stops the table filling
      // with rows nothing will ever look at again.
      await conn.execute('DELETE FROM `apikey` WHERE `userId` = ?', [userId])
      // Any outstanding magic link or reset token for this address dies with the
      // account, so a link already in an inbox can't resurrect access.
      await conn.execute(
        'DELETE v FROM `verification` v JOIN `user` u ON u.email = v.identifier WHERE u.id = ?',
        [userId]
      )
      // Leaves `transfer_recipients` rows that merely named this address on
      // someone else's transfer — those are part of that transfer's history, not
      // this account's data.
      await conn.execute('DELETE FROM `user` WHERE `id` = ?', [userId])
      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    return { success: true, transfersDeleted: transfers.length }
  } catch (error) {
    logger.error('Delete user error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
