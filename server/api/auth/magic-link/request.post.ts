import type { RowDataPacket } from 'mysql2'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { sendEmail } from '../../../../app/lib/sendEmail'
import { emailContext, renderMagicLinkEmail } from '../../../utils/emailTemplates'
import { enforceRateLimit, magicLinkLimiter } from '../../../utils/rateLimit'
import { isValidEmail, normalizeEmail } from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Issue a one-time sign-in link to a known address.
//
// This is the only way an outside guest gets in: an admin adds their address, and
// from then on they can request a link themselves. There is no public signup, so
// an address that isn't on the list gets nothing — which is exactly what stops
// strangers uploading to the server.
export default defineEventHandler(async (event) => {
  // Every request sends mail, so all of them count.
  if (!enforceRateLimit(event, magicLinkLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const body = await readBody(event)
    const { email } = body || {}

    if (!isValidEmail(email)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_EMAIL' }
    }

    const config = useRuntimeConfig(event)
    const minutes = Number(config.magicLinkMaxAgeMinutes) || 30

    const db = setupDatabase()
    const normalized = normalizeEmail(email)

    // Members can request one too. They have a password, but it means someone who
    // has forgotten it can still get in from their inbox, and it keeps this
    // endpoint from being an oracle for "is this address a guest or staff?".
    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, banned FROM `user` WHERE `email` = ?',
      [normalized]
    )

    const user = users[0]

    if (user && !user.banned) {
      const token = uuidv4()
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000)

      // Invalidate any outstanding link for this address first. Otherwise every
      // request leaves another live token in the mailbox, and the oldest one is
      // the likeliest to have leaked.
      await db.execute(
        'DELETE FROM `verification` WHERE `identifier` = ? AND `purpose` = ?',
        [normalized, 'magic_link']
      )

      await db.execute(
        'INSERT INTO `verification` (`id`, `identifier`, `value`, `purpose`, `expiresAt`) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), normalized, token, 'magic_link', expiresAt]
      )

      const ctx = emailContext(event)
      const { subject, html } = renderMagicLinkEmail(ctx, {
        url: `${ctx.appUrl}/magic/${token}`,
        minutes
      })

      try {
        await sendEmail({ to: user.email, subject, html })
      } catch (mailError) {
        // Not surfaced, for the same reason as the password reset: the response
        // must not reveal whether the address is on the list.
        logger.error('Magic link email failed', mailError)
      }
    }

    // Same response for a known address, an unknown one and a banned one.
    return { success: true }
  } catch (error) {
    logger.error('Magic link request error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
