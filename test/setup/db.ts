import type { RowDataPacket } from 'mysql2'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { setupDatabase, schemaReady } from '../../app/lib/databaseSetup'
import { TEST_STORAGE } from './testConfig'

// Fixtures and reset helpers shared by the integration and end-to-end tests.

/** Bring the test database up to date, using the app's own migration runner. */
export async function migrateTestDatabase() {
  await schemaReady()
}

/**
 * Empty every table and the storage root.
 *
 * Called before each test rather than after, so a failing test leaves its data
 * behind to be inspected. Foreign keys are not declared on these tables, but the
 * order still follows the dependency direction so this keeps working if they
 * ever are.
 */
export async function resetState() {
  const db = setupDatabase()
  for (const table of [
    'transfer_files',
    'transfer_recipients',
    'transfers',
    'apikey',
    'session',
    'verification',
    'account',
    'user'
  ]) {
    await db.execute(`DELETE FROM \`${table}\``)
  }

  await fs.rm(join(TEST_STORAGE, 'transfers'), { recursive: true, force: true })
}

export interface TestUser {
  id: string
  name: string
  email: string
  password: string
  role: string
  type: string
}

/** Create an account that can actually sign in — `user` row plus `account` row. */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const db = setupDatabase()

  const user: TestUser = {
    id: uuidv4(),
    name: 'Test Member',
    email: `member-${Math.random().toString(36).slice(2, 10)}@example.com`,
    password: 'TestPassword1234',
    role: 'user',
    type: 'member',
    ...overrides
  }

  await db.execute(
    'INSERT INTO `user` (`id`, `name`, `email`, `role`, `type`, `emailVerified`) VALUES (?, ?, ?, ?, ?, 1)',
    [user.id, user.name, user.email, user.role, user.type]
  )

  // Guests have no password by design — they only ever sign in by magic link —
  // so no account row is written for them.
  if (user.type === 'member') {
    await db.execute(
      // `local` is the provider id the sign-in endpoint looks up; a different
      // value here silently produces an account that can never sign in.
      'INSERT INTO `account` (`id`, `userId`, `providerId`, `accountId`, `password`) VALUES (?, ?, \'local\', ?, ?)',
      [uuidv4(), user.id, user.email, await bcrypt.hash(user.password, 10)]
    )
  }

  return user
}

/** Read one transfer row, or undefined once it has been swept. */
export async function getTransferRow(id: number): Promise<RowDataPacket | undefined> {
  const db = setupDatabase()
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM `transfers` WHERE `id` = ?',
    [id]
  )
  return rows[0]
}

/** Whether a transfer's storage directory still exists. */
export async function transferDirExists(id: number): Promise<boolean> {
  try {
    const stats = await fs.stat(join(TEST_STORAGE, 'transfers', String(id)))
    return stats.isDirectory()
  } catch {
    return false
  }
}

/** Files currently on disk for a transfer. */
export async function listStoredFiles(id: number): Promise<string[]> {
  try {
    return await fs.readdir(join(TEST_STORAGE, 'transfers', String(id)))
  } catch {
    return []
  }
}
