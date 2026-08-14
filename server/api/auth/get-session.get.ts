import { resolveSession } from '../../utils/auth'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  try {
    const result = await resolveSession(event)

    if (result.status === 'banned') {
      // Don't leak why.
      setResponseStatus(event, 403)
      return { error: 'ACCESS_DENIED' }
    }

    if (result.status !== 'ok') {
      setResponseStatus(event, 401)
      return { error: 'NOT_AUTHENTICATED' }
    }

    // The session token itself is never echoed back — it lives in an httpOnly
    // cookie and nothing in the client needs to read it.
    return { data: { session: result.session, user: result.user } }
  } catch (error) {
    logger.error('Get session error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
