import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { sendEmail } from '../../../../app/lib/sendEmail'
import { fail, requireAdmin } from '../../../utils/auth'
import {
  emailContext,
  renderGuestWelcomeEmail,
  renderWelcomeEmail
} from '../../../utils/emailTemplates'
import {
  cleanString,
  isValidEmail,
  isValidPassword,
  normalizeEmail
} from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Create an account. This is the only way accounts come into existence — there is
// no public signup, because anyone with an account can put files on the server.
//
// Two kinds:
//   member — internal staff. Password login, can send transfers.
//   guest  — an outside contact (an agency customer). No password at all; they
//            request a magic link and can only upload to a chosen member.
export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const body = await readBody(event)
    const {
      email,
      password,
      role = 'user',
      type = 'member',
      sendWelcome = true
    } = body || {}

    const name = cleanString(body?.name, 255)
    const company = cleanString(body?.company, 255)

    if (!name) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_NAME' }
    }

    if (!isValidEmail(email)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_EMAIL' }
    }

    if (type !== 'member' && type !== 'guest') {
      setResponseStatus(event, 400)
      return { error: 'INVALID_TYPE' }
    }

    if (role !== 'user' && role !== 'admin') {
      setResponseStatus(event, 400)
      return { error: 'INVALID_ROLE' }
    }

    // A guest is never an admin: the whole point of the type is that it can't
    // reach anything but its own upload form.
    const effectiveRole = type === 'guest' ? 'user' : role

    // Members need a password; guests must not have one.
    if (type === 'member' && !isValidPassword(password)) {
      setResponseStatus(event, 400)
      return { error: 'INVALID_PASSWORD' }
    }

    const db = setupDatabase()
    const normalized = normalizeEmail(email)

    const [existing] = await db.execute<RowDataPacket[]>('SELECT id FROM `user` WHERE `email` = ?', [
      normalized
    ])
    if (existing.length > 0) {
      setResponseStatus(event, 409)
      return { error: 'EMAIL_ALREADY_EXISTS' }
    }

    const userId = uuidv4()

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      await conn.execute(
        'INSERT INTO `user` (`id`, `name`, `email`, `emailVerified`, `role`, `type`, `company`) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, name, normalized, 1, effectiveRole, type, company]
      )

      if (type === 'member') {
        const hashedPassword = await bcrypt.hash(password, 10)
        await conn.execute(
          'INSERT INTO `account` (`id`, `accountId`, `providerId`, `userId`, `password`) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), normalized, 'local', userId, hashedPassword]
        )
      }

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    // Best-effort: the account exists either way, so a mail failure is reported
    // rather than rolled back — the admin can fall back to passing on the
    // credentials by hand.
    let emailSent = false
    if (sendWelcome) {
      try {
        const ctx = emailContext(event)
        const rendered
          = type === 'member'
            ? renderWelcomeEmail(ctx, {
                name,
                adminName: auth.user.name,
                email: normalized,
                password
              })
            : renderGuestWelcomeEmail(ctx, { name })

        await sendEmail({ to: normalized, subject: rendered.subject, html: rendered.html })
        emailSent = true
      } catch (mailError) {
        logger.error('Welcome email failed', mailError)
      }
    }

    return {
      success: true,
      emailSent,
      user: { id: userId, name, email: normalized, role: effectiveRole, type, company }
    }
  } catch (error) {
    logger.error('Create user error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
