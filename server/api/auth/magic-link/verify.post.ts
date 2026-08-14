import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { createSession } from '../../../utils/auth'
import { enforceRateLimit, magicLinkLimiter } from '../../../utils/rateLimit'
import { isUuid } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Redeem a magic link and start a session.
//
// Consuming the token is a DELETE that checks its own result: the row is removed
// and only the request that actually removed it (affectedRows === 1) is allowed
// to continue. If the same link is opened twice at once — a mail client
// prefetching it while the recipient clicks, say — exactly one wins, so a
// prefetch can't silently burn the link the person is about to use.
export default defineEventHandler(async (event) => {
  if (!enforceRateLimit(event, magicLinkLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const body = await readBody(event)
    const { token } = body || {}

    if (!isUuid(token)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    const db = setupDatabase()

    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT `identifier` FROM `verification` WHERE `value` = ? AND `purpose` = ? AND `expiresAt` > NOW()',
      [token, 'magic_link']
    )

    const pending = rows[0]
    if (!pending) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    const [deleted] = await db.execute<ResultSetHeader>(
      'DELETE FROM `verification` WHERE `value` = ? AND `purpose` = ?',
      [token, 'magic_link']
    )

    // Someone else already redeemed it in the moment between the two queries.
    if (deleted.affectedRows !== 1) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, role, type, company, banned FROM `user` WHERE `email` = ?',
      [pending.identifier]
    )

    const user = users[0]
    if (!user || user.banned) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TOKEN' }
    }

    // Guests get the short guest session; a member redeeming a link gets the
    // normal member lifetime, since for them this is just another way to sign in.
    const sessionResult = await createSession(event, user.id, user.type)
    if (sessionResult.error) {
      setResponseStatus(event, 500)
      return { error: 'AUTHENTICATION_FAILED' }
    }

    return {
      data: {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          type: user.type
        }
      }
    }
  } catch (error) {
    logger.error('Magic link verify error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
