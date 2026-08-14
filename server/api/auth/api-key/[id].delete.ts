import type { ResultSetHeader } from 'mysql2'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireSessionMember } from '../../../utils/auth'
import { isUuid } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Revoke a key. Deleted outright rather than flagged: revocation should leave
// nothing behind that could be re-enabled, and the row carries no history worth
// keeping once the key is dead.
//
// Session-only, like creation — a leaked key must not be able to revoke the
// others and lock the owner out of their own integrations.
export default defineEventHandler(async (event) => {
  const auth = await requireSessionMember(event)
  if (!auth.ok) return fail(event, auth)

  const id = getRouterParam(event, 'id')
  if (!isUuid(id)) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_KEY' }
  }

  try {
    const db = setupDatabase()

    // Scoped to the caller's own keys, so an id guessed from elsewhere revokes
    // nothing. A miss and a wrong owner are indistinguishable from the outside.
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM `apikey` WHERE `id` = ? AND `userId` = ?',
      [id, auth.user.id]
    )

    if (result.affectedRows === 0) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    logger.info('API key revoked', { keyId: id, userId: auth.user.id })

    return { success: true }
  } catch (error) {
    logger.error('Revoke API key error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
