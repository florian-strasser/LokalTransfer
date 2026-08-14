import type { RowDataPacket } from 'mysql2'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { sendEmail } from '../../../app/lib/sendEmail'
import { emailContext, renderPasswordResetEmail } from '../../utils/emailTemplates'
import { enforceRateLimit, passwordRequestLimiter } from '../../utils/rateLimit'
import { isValidEmail, normalizeEmail } from '../../utils/validation'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  // Every request here sends an e-mail, so each one counts against the budget —
  // this limits both inbox bombing and address probing.
  if (!enforceRateLimit(event, passwordRequestLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const body = await readBody(event)
    const { email } = body || {}

    if (!isValidEmail(email)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_EMAIL' }
    }

    const db = setupDatabase()
    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, type FROM `user` WHERE `email` = ? AND `type` = ?',
      [normalizeEmail(email), 'member']
    )

    // Guests deliberately match nothing here: they have no password to reset,
    // and the magic-link flow is their way in.
    const user = users[0]
    if (user) {
      const token = uuidv4()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.execute(
        'INSERT INTO `verification` (`id`, `identifier`, `value`, `purpose`, `expiresAt`) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), user.email, token, 'password_reset', expiresAt]
      )

      const ctx = emailContext(event)
      const { subject, html } = renderPasswordResetEmail(ctx, {
        url: `${ctx.appUrl}/reset-password/${token}`
      })

      try {
        await sendEmail({ to: user.email, subject, html })
      } catch (mailError) {
        // Swallowed on purpose: a delivery failure must not change the response,
        // or the difference would reveal that the address exists.
        logger.error('Password reset email failed', mailError)
      }
    }

    // Identical response whether or not the address is known.
    return { success: true }
  } catch (error) {
    logger.error('Request password reset error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
