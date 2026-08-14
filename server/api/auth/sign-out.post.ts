import { deleteCookie, getCookie } from 'h3'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { SESSION_COOKIE } from '../../utils/auth'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const sessionToken = getCookie(event, SESSION_COOKIE)

    // The cookie goes regardless of what the database says, so a stale or
    // already-deleted session still leaves the browser logged out.
    deleteCookie(event, SESSION_COOKIE, { path: '/' })

    if (sessionToken && typeof sessionToken === 'string' && sessionToken.length >= 10) {
      const db = setupDatabase()
      await db.execute('DELETE FROM `session` WHERE `token` = ?', [sessionToken])
    }

    return { success: true }
  } catch (error) {
    logger.error('Sign-out error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
