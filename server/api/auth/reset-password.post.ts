import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { enforceRateLimit, passwordResetLimiter } from '../../utils/rateLimit'
import { isUuid, isValidPassword } from '../../utils/validation'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  // Counts every submission, which caps token guessing.
  if (!enforceRateLimit(event, passwordResetLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const body = await readBody(event)
    const { token, password } = body || {}

    if (!isUuid(token)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    if (!isValidPassword(password)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_PASSWORD' }
    }

    const db = setupDatabase()

    // `purpose` is part of the lookup: a magic-link token must never be
    // redeemable as a password reset, even though both live in this table.
    const [tokens] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM `verification` WHERE `value` = ? AND `purpose` = ? AND `expiresAt` > NOW()',
      [token, 'password_reset']
    )

    const verification = tokens[0]
    if (!verification) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM `user` WHERE `email` = ? AND `type` = ?',
      [verification.identifier, 'member']
    )

    const user = users[0]
    if (!user) {
      // Same message as a bad token: the account was removed after the mail went
      // out, and saying so would confirm the address had once existed.
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute(
        'UPDATE `account` SET `password` = ?, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `userId` = ? AND `providerId` = ?',
        [hashedPassword, user.id, 'local']
      )

      // Burn the token so the link in the mailbox can't be replayed.
      await conn.execute('DELETE FROM `verification` WHERE `value` = ?', [token])

      // Drop every existing session. If the reset was triggered because someone
      // else had access, this is what actually locks them out.
      await conn.execute('DELETE FROM `session` WHERE `userId` = ?', [user.id])

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    return { success: true }
  } catch (error) {
    logger.error('Reset password error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
