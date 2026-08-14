import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireAdmin } from '../../../utils/auth'
import { logger } from '../../../utils/logger'

// List every account — internal members and external guests alike — for the
// admin user management screen.
export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const db = setupDatabase()

    // The transfer counts come from a correlated subquery rather than a join, so
    // a user with no transfers still appears and the count stays accurate
    // without a GROUP BY over every column.
    const [users] = await db.execute<RowDataPacket[]>(
      `SELECT
         u.id, u.name, u.email, u.role, u.type, u.company, u.banned, u.createdAt,
         (SELECT COUNT(*) FROM transfers t WHERE t.senderId = u.id AND t.status = 'sent') AS transferCount
       FROM \`user\` u
       ORDER BY u.type ASC, u.name ASC`
    )

    return {
      data: users.map((user: RowDataPacket) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        type: user.type,
        company: user.company,
        banned: !!user.banned,
        createdAt: user.createdAt,
        transferCount: Number(user.transferCount)
      }))
    }
  } catch (error) {
    logger.error('List users error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
