import { setupDatabase } from '../../../app/lib/databaseSetup'
import { fail, requireMember } from '../../utils/auth'
import { removeUserFile } from '../../utils/storage'
import { logger } from '../../utils/logger'

// Remove the signed-in member's default background. New transfers go out without
// one again; transfers already created keep their own copies.
export default defineEventHandler(async (event) => {
  const auth = await requireMember(event)
  if (!auth.ok) return fail(event, auth)

  try {
    if (auth.user.backgroundName) {
      await removeUserFile(auth.user.id, auth.user.backgroundName, event)
    }

    await setupDatabase().execute(
      'UPDATE `user` SET `backgroundName` = NULL, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
      [auth.user.id]
    )

    return { data: { background: null } }
  } catch (error) {
    logger.error('Default background removal error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
