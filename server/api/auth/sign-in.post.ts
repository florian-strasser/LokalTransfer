import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { createSession } from '../../utils/auth'
import { blockIfRateLimited, recordFailure, signInLimiter } from '../../utils/rateLimit'
import { isValidEmail, isValidPassword, normalizeEmail } from '../../utils/validation'
import { logger } from '../../utils/logger'

// A bcrypt hash of a value nobody knows. Compared against when there is no user
// or no password on file, so a request for a non-existent account costs the same
// time as one for a real account — otherwise response timing alone reveals which
// addresses are registered.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

export default defineEventHandler(async (event) => {
  // Throttle brute-force logins per client IP. Only *failed* attempts count
  // (recorded below), so a busy office behind one IP isn't locked out by its own
  // successful logins.
  if (blockIfRateLimited(event, signInLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const body = await readBody(event)
    const { email, password } = body || {}

    // Every rejection below returns the same message. Distinguishing "unknown
    // address" from "wrong password" would turn this endpoint into a directory
    // of who has an account.
    if (!isValidEmail(email) || !isValidPassword(password)) {
      await bcrypt.compare(String(password ?? ''), DUMMY_HASH)
      recordFailure(event, signInLimiter)
      setResponseStatus(event, 401)
      return { error: 'INVALID_EMAIL_OR_PASSWORD' }
    }

    const db = setupDatabase()

    const [users] = await db.execute<RowDataPacket[]>(
      'SELECT id, name, email, role, type, banned FROM `user` WHERE `email` = ?',
      [normalizeEmail(email)]
    )
    const user = users[0]

    // Guests have no password — they authenticate by magic link. Treating this
    // as an ordinary credential failure avoids confirming that the address is
    // registered as a guest.
    if (!user || user.type !== 'member') {
      await bcrypt.compare(password, DUMMY_HASH)
      recordFailure(event, signInLimiter)
      setResponseStatus(event, 401)
      return { error: 'INVALID_EMAIL_OR_PASSWORD' }
    }

    const [accounts] = await db.execute<RowDataPacket[]>(
      'SELECT password FROM `account` WHERE `userId` = ? AND `providerId` = ?',
      [user.id, 'local']
    )
    const account = accounts[0]

    // A member row with no credentials shouldn't exist, but if it does, still
    // spend the time on a comparison before rejecting, for the same reason as
    // above.
    const isPasswordValid = account?.password
      ? await bcrypt.compare(password, account.password)
      : (await bcrypt.compare(password, DUMMY_HASH), false)

    if (!isPasswordValid) {
      recordFailure(event, signInLimiter)
      setResponseStatus(event, 401)
      return { error: 'INVALID_EMAIL_OR_PASSWORD' }
    }

    // Checked after the password so a banned user learns nothing an attacker
    // couldn't already learn by guessing the password correctly.
    if (user.banned) {
      setResponseStatus(event, 403)
      return { error: 'ACCOUNT_DISABLED' }
    }

    const sessionResult = await createSession(event, user.id, 'member')
    if (sessionResult.error) {
      logger.error('Session creation failed during sign-in', sessionResult.error)
      setResponseStatus(event, 500)
      return { error: 'AUTHENTICATION_FAILED' }
    }

    return {
      data: {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, type: user.type }
      }
    }
  } catch (error) {
    logger.error('Sign-in error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
