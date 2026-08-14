import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase } from '../../../../app/lib/databaseSetup'
import { fail, requireAdmin } from '../../../utils/auth'
import {
  cleanString,
  isValidEmail,
  isValidPassword,
  normalizeEmail
} from '../../../utils/validation'
import { logger } from '../../../utils/logger'

// Update an account. Every field is optional; only what is present is written.
export default defineEventHandler(async (event) => {
  const auth = await requireAdmin(event)
  if (!auth.ok) return fail(event, auth)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    setResponseStatus(event, 400)
    return { error: 'INVALID_USER' }
  }

  try {
    const db = setupDatabase()
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id, email, role, type FROM `user` WHERE `id` = ?',
      [userId]
    )
    const target = existing[0]

    if (!target) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const body = await readBody(event)
    const updates: string[] = []
    // Column values for the dynamic UPDATE, in the same order as `updates`.
    const values: (string | number | null)[] = []

    if (body?.name !== undefined) {
      const name = cleanString(body.name, 255)
      if (!name) {
        setResponseStatus(event, 400)
        return { error: 'INVALID_NAME' }
      }
      updates.push('`name` = ?')
      values.push(name)
    }

    if (body?.company !== undefined) {
      updates.push('`company` = ?')
      values.push(cleanString(body.company, 255))
    }

    if (body?.email !== undefined) {
      if (!isValidEmail(body.email)) {
        setResponseStatus(event, 400)
        return { error: 'INVALID_EMAIL' }
      }
      const normalized = normalizeEmail(body.email)
      const [clash] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM `user` WHERE `email` = ? AND `id` <> ?',
        [normalized, userId]
      )
      if (clash.length > 0) {
        setResponseStatus(event, 409)
        return { error: 'EMAIL_ALREADY_EXISTS' }
      }
      updates.push('`email` = ?')
      values.push(normalized)
    }

    if (body?.role !== undefined) {
      if (body.role !== 'user' && body.role !== 'admin') {
        setResponseStatus(event, 400)
        return { error: 'INVALID_ROLE' }
      }
      // Guests can never be promoted; that would hand an outside contact the
      // admin screens.
      if (target.type === 'guest' && body.role === 'admin') {
        setResponseStatus(event, 400)
        return { error: 'INVALID_ROLE' }
      }
      // An admin must not be able to demote themselves — the realistic accident
      // is the last admin doing it and locking everyone out of user management.
      if (target.id === auth.user.id && body.role !== 'admin') {
        setResponseStatus(event, 400)
        return { error: 'CANNOT_DEMOTE_SELF' }
      }
      updates.push('`role` = ?')
      values.push(body.role)
    }

    if (body?.banned !== undefined) {
      // Same reasoning as above: locking yourself out is never the intent.
      if (target.id === auth.user.id && body.banned) {
        setResponseStatus(event, 400)
        return { error: 'CANNOT_BAN_SELF' }
      }
      updates.push('`banned` = ?')
      values.push(body.banned ? 1 : 0)
    }

    if (updates.length > 0) {
      updates.push('`updatedAt` = CURRENT_TIMESTAMP(3)')
      await db.execute(`UPDATE \`user\` SET ${updates.join(', ')} WHERE \`id\` = ?`, [
        ...values,
        userId
      ])
    }

    // A password reset by an admin is handled apart from the column updates,
    // because it also has to invalidate the target's sessions.
    if (body?.password !== undefined) {
      if (target.type !== 'member') {
        setResponseStatus(event, 400)
        return { error: 'GUESTS_HAVE_NO_PASSWORD' }
      }
      if (!isValidPassword(body.password)) {
        setResponseStatus(event, 400)
        return { error: 'INVALID_PASSWORD' }
      }

      const hashedPassword = await bcrypt.hash(body.password, 10)
      const [accounts] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM `account` WHERE `userId` = ? AND `providerId` = ?',
        [userId, 'local']
      )

      const account = accounts[0]
      if (account) {
        await db.execute(
          'UPDATE `account` SET `password` = ?, `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
          [hashedPassword, account.id]
        )
      } else {
        await db.execute(
          'INSERT INTO `account` (`id`, `accountId`, `providerId`, `userId`, `password`) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), target.email, 'local', userId, hashedPassword]
        )
      }

      await db.execute('DELETE FROM `session` WHERE `userId` = ?', [userId])
    }

    // Banning is only meaningful if it takes effect now, not when the session
    // happens to expire.
    if (body?.banned) {
      await db.execute('DELETE FROM `session` WHERE `userId` = ?', [userId])
    }

    return { success: true }
  } catch (error) {
    logger.error('Update user error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
