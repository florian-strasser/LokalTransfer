import { setupDatabase } from '../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../utils/auth'
import { cleanString } from '../../utils/validation'
import { logger } from '../../utils/logger'

// Edit your own profile. Deliberately narrow: name and company only.
//
// E-mail is not editable here. It is the identity a transfer is delivered to and
// the handle a magic link is issued against, so changing it is an admin action
// (see api/admin/users) rather than something a session can do to itself.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const body = await readBody(event)
    const name = cleanString(body?.name, 255)
    const company = cleanString(body?.company, 255)

    if (!name) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_NAME' }
    }

    const db = setupDatabase()
    await db.execute(
      'UPDATE `user` SET `name` = ?, `company` = ?, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
      [name, company, auth.user.id]
    )

    return { success: true, user: { ...auth.user, name, company } }
  } catch (error) {
    logger.error('Update user error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
