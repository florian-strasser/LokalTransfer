import type { RowDataPacket } from 'mysql2'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { schemaReady, setupDatabase } from '../../app/lib/databaseSetup'
import { isValidEmail, isValidPassword, normalizeEmail } from '../utils/validation'
import { logger } from '../utils/logger'

// Seed the first administrator from the environment.
//
// There is no public signup — every account is created from the admin UI — which
// leaves a chicken-and-egg problem on a fresh instance: no admin means no way to
// make one. `scripts/create-admin.mjs` solves that interactively, but a container
// or a managed host where running a one-off shell command is awkward needs it to
// be declarative, so NUXT_ADMIN_EMAIL / NUXT_ADMIN_PASSWORD do it at boot.
//
// The rules that keep this safe to leave configured permanently:
//
//   * It only ever acts when the instance has **no administrator at all**. Once
//     one exists this is a no-op, so a password changed in the UI is never
//     silently reverted to whatever is still sitting in the environment.
//   * It never modifies an existing account's password.
//   * Failures are logged, not thrown. A typo'd address shouldn't stop a running
//     service — existing download links keep working, and the operator gets a
//     clear line in the log.
//
// It doubles as a recovery hatch: if the last administrator is ever removed,
// restarting with these set restores access.
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  const email = String(config.adminEmail || '').trim()
  const password = String(config.adminPassword || '')
  const name = String(config.adminName || 'Administrator').trim() || 'Administrator'

  // Not configured at all is the normal case for an instance bootstrapped with
  // the CLI script; say nothing.
  if (!email && !password) return

  try {
    // Nitro doesn't guarantee that the migration plugin has run first, so wait
    // for the schema explicitly rather than assuming the tables exist.
    await schemaReady()

    const db = setupDatabase()

    const [admins] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM `user` WHERE `role` = \'admin\' AND `type` = \'member\' LIMIT 1'
    )

    if (admins.length > 0) {
      logger.debug('Admin bootstrap skipped: an administrator already exists')
      return
    }

    if (!isValidEmail(email)) {
      logger.error('Admin bootstrap failed: NUXT_ADMIN_EMAIL is not a valid e-mail address')
      return
    }

    const normalized = normalizeEmail(email)

    // The address may already belong to someone — most likely an admin who was
    // demoted, or a member created before the last admin was deleted.
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id, type FROM `user` WHERE `email` = ?',
      [normalized]
    )
    const current = existing[0]

    if (current) {
      // Promoting a guest would hand an outside contact the admin screens on the
      // strength of an environment variable. Refuse and say why.
      if (current.type !== 'member') {
        logger.error(
          'Admin bootstrap failed: NUXT_ADMIN_EMAIL belongs to a guest account. '
          + 'Use a different address, or change that account to a team member first.',
          { email: normalized }
        )
        return
      }

      // Promote in place. Deliberately leaves the password alone: this account
      // already has one its owner knows, and the environment shouldn't override
      // it behind their back.
      await db.execute(
        'UPDATE `user` SET `role` = \'admin\', `updatedAt` = CURRENT_TIMESTAMP(3) WHERE `id` = ?',
        [current.id]
      )
      logger.info(
        'Admin bootstrap: promoted the existing member to administrator (password unchanged)',
        { email: normalized }
      )
      return
    }

    // Creating an account does need a password.
    if (!isValidPassword(password)) {
      logger.error(
        'Admin bootstrap failed: NUXT_ADMIN_PASSWORD must be at least 8 characters',
        { email: normalized }
      )
      return
    }

    const userId = uuidv4()
    const hashedPassword = await bcrypt.hash(password, 10)

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(
        'INSERT INTO `user` (`id`, `name`, `email`, `emailVerified`, `role`, `type`) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, name, normalized, 1, 'admin', 'member']
      )
      await conn.execute(
        'INSERT INTO `account` (`id`, `accountId`, `providerId`, `userId`, `password`) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), normalized, 'local', userId, hashedPassword]
      )
      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    logger.info('Admin bootstrap: created the first administrator', { email: normalized })
    logger.warn(
      'Change this password after signing in. Once you have, NUXT_ADMIN_PASSWORD '
      + 'can be removed from the environment — it is only read when no administrator exists.'
    )
  } catch (error) {
    logger.error('Admin bootstrap failed', error)
  }
})
