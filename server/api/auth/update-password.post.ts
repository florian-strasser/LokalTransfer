import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { getCookie } from 'h3'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { SESSION_COOKIE, fail, requireMember } from '../../utils/auth'
import { isValidPassword } from '../../utils/validation'
import { logger } from '../../utils/logger'

// Change your own password while signed in. Requires the current password, so a
// borrowed session can't be used to lock the real owner out.
export default defineEventHandler(async (event) => {
  const auth = await requireMember(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const body = await readBody(event)
    const { currentPassword, newPassword } = body || {}

    if (typeof currentPassword !== 'string' || !isValidPassword(newPassword)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_PASSWORD' }
    }

    const db = setupDatabase()
    const [accounts] = await db.execute<RowDataPacket[]>(
      'SELECT id, password FROM `account` WHERE `userId` = ? AND `providerId` = ?',
      [auth.user.id, 'local']
    )

    const account = accounts[0]
    if (!account?.password || !(await bcrypt.compare(currentPassword, account.password))) {
      setResponseStatus(event, 403)
      return { error: 'INVALID_CURRENT_PASSWORD' }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const currentSession = getCookie(event, SESSION_COOKIE)

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute(
        'UPDATE `account` SET `password` = ?, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
        [hashedPassword, account.id]
      )

      // Sign out everywhere else but keep this browser signed in — changing your
      // password shouldn't kick you out of the page you just did it on.
      await conn.execute('DELETE FROM `session` WHERE `userId` = ? AND `token` <> ?', [
        auth.user.id,
        currentSession || ''
      ])

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    return { success: true }
  } catch (error) {
    logger.error('Update password error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
