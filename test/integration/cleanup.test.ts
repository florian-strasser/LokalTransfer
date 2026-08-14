import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { TEST_STORAGE } from '../setup/testConfig'
import {
  createTestUser,
  getTransferRow,
  listStoredFiles,
  migrateTestDatabase,
  resetState,
  transferDirExists
} from '../setup/db'

// The sweep is what makes retention real: without it, "the files are deleted
// from the server" is only "the files are unreachable". It runs unattended on a
// timer, so nobody is watching when it goes wrong — which is exactly why it is
// worth testing the disk, not just the rows.

// Captures outbound mail instead of sending it. Declared with `vi.hoisted` so
// the array exists before the module factory below runs.
const sentMail = vi.hoisted(() => [] as { to: string, subject: string, html: string }[])

vi.mock('../../app/lib/sendEmail', () => ({
  sendEmail: vi.fn(async (options: { to: string, subject: string, html: string }) => {
    sentMail.push(options)
    return { messageId: 'test' }
  })
}))

const { default: cleanupTask } = await import('../../server/tasks/cleanup')

/** Run the real scheduled task and hand back its summary. */
async function runCleanup() {
  const outcome = await cleanupTask.run({} as never)
  return outcome.result as Record<string, number> & { failed?: boolean }
}

interface SeedOptions {
  status?: 'draft' | 'sent'
  /** Hours from now. Negative is in the past; null means no expiry. */
  expiresInHours?: number | null
  sentHoursAgo?: number
  createdHoursAgo?: number
  recipients?: string[]
  downloadCount?: number
  fileCount?: number
  subject?: string | null
  senderEmail?: string
}

/** Create a transfer row with matching files on disk, as the app would. */
async function seedTransfer(options: SeedOptions = {}) {
  const {
    status = 'sent',
    expiresInHours = 48,
    sentHoursAgo = 1,
    createdHoursAgo = 1,
    recipients = ['client@example.com'],
    downloadCount = 0,
    fileCount = 1,
    subject = 'Test transfer',
    senderEmail = 'sender@example.com'
  } = options

  const db = setupDatabase()
  const token = Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO \`transfers\`
     (\`token\`, \`senderId\`, \`senderName\`, \`senderEmail\`, \`kind\`, \`subject\`, \`status\`,
      \`retentionDays\`, \`expiresAt\`, \`downloadCount\`, \`layout\`, \`createdAt\`, \`sentAt\`)
     VALUES (?, NULL, 'Sender', ?, 'outgoing', ?, ?, 7,
             ${expiresInHours === null ? 'NULL' : 'DATE_ADD(NOW(), INTERVAL ? HOUR)'},
             ?, 'list',
             DATE_SUB(NOW(), INTERVAL ? HOUR),
             ${status === 'sent' ? 'DATE_SUB(NOW(), INTERVAL ? HOUR)' : 'NULL'})`,
    [
      token,
      senderEmail,
      subject,
      status,
      ...(expiresInHours === null ? [] : [expiresInHours]),
      downloadCount,
      createdHoursAgo,
      ...(status === 'sent' ? [sentHoursAgo] : [])
    ]
  )

  const transferId = Number(result.insertId)

  const dir = join(TEST_STORAGE, 'transfers', String(transferId))
  await fs.mkdir(dir, { recursive: true })

  for (let i = 0; i < fileCount; i++) {
    const storedName = `stored-${transferId}-${i}`
    await fs.writeFile(join(dir, storedName), `contents of file ${i}`)
    await db.execute(
      'INSERT INTO `transfer_files` (`transfer`, `filename`, `storedName`, `mimeType`, `size`) VALUES (?, ?, ?, ?, ?)',
      [transferId, `file-${i}.txt`, storedName, 'text/plain', 20]
    )
  }

  for (const email of recipients) {
    await db.execute(
      'INSERT INTO `transfer_recipients` (`transfer`, `userId`, `email`, `name`) VALUES (?, NULL, ?, NULL)',
      [transferId, email]
    )
  }

  return { transferId, token }
}

beforeAll(async () => {
  await migrateTestDatabase()
})

beforeEach(async () => {
  await resetState()
  sentMail.length = 0
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('expired transfers', () => {
  it('deletes the rows, the join rows and the files on disk', async () => {
    const { transferId } = await seedTransfer({ expiresInHours: -1 })

    // Everything is in place before the sweep.
    expect(await transferDirExists(transferId)).toBe(true)
    expect(await listStoredFiles(transferId)).toHaveLength(1)

    const summary = await runCleanup()
    expect(summary.expired).toBe(1)

    expect(await getTransferRow(transferId)).toBeUndefined()
    // The part that makes the promise literal rather than merely "unreachable".
    expect(await transferDirExists(transferId)).toBe(false)

    const db = setupDatabase()
    const [files] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM `transfer_files` WHERE `transfer` = ?',
      [transferId]
    )
    const [recipients] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM `transfer_recipients` WHERE `transfer` = ?',
      [transferId]
    )
    expect(files).toHaveLength(0)
    expect(recipients).toHaveLength(0)
  })

  it('leaves a transfer that has not lapsed yet', async () => {
    const { transferId } = await seedTransfer({ expiresInHours: 48 })

    const summary = await runCleanup()
    expect(summary.expired).toBe(0)
    expect(await getTransferRow(transferId)).toBeDefined()
    expect(await transferDirExists(transferId)).toBe(true)
  })

  it('never touches a transfer with no expiry', async () => {
    // NULL is the unlimited-retention case, which is why it was chosen over a
    // far-future sentinel date — a sentinel would eventually arrive.
    const { transferId } = await seedTransfer({ expiresInHours: null })

    await runCleanup()
    expect(await getTransferRow(transferId)).toBeDefined()
    expect(await transferDirExists(transferId)).toBe(true)
  })

  it('removes every expired transfer in one pass', async () => {
    const a = await seedTransfer({ expiresInHours: -1 })
    const b = await seedTransfer({ expiresInHours: -100, fileCount: 3 })
    const alive = await seedTransfer({ expiresInHours: 24 })

    const summary = await runCleanup()
    expect(summary.expired).toBe(2)

    expect(await transferDirExists(a.transferId)).toBe(false)
    expect(await transferDirExists(b.transferId)).toBe(false)
    expect(await transferDirExists(alive.transferId)).toBe(true)
  })
})

describe('abandoned drafts', () => {
  it('sweeps a draft older than the grace period', async () => {
    const { transferId } = await seedTransfer({
      status: 'draft',
      expiresInHours: 100,
      createdHoursAgo: 48
    })

    const summary = await runCleanup()
    expect(summary.drafts).toBe(1)
    expect(await getTransferRow(transferId)).toBeUndefined()
    expect(await transferDirExists(transferId)).toBe(false)
  })

  it('leaves a recent draft alone, so a slow upload is not interrupted', async () => {
    const { transferId } = await seedTransfer({
      status: 'draft',
      expiresInHours: 100,
      createdHoursAgo: 1
    })

    const summary = await runCleanup()
    expect(summary.drafts).toBe(0)
    expect(await getTransferRow(transferId)).toBeDefined()
  })
})

describe('orphaned directories', () => {
  it('removes a directory with no matching row', async () => {
    // The residue of a crash between deleting rows and deleting files, or of a
    // database restored from a backup older than the disk.
    const orphan = join(TEST_STORAGE, 'transfers', '999999')
    await fs.mkdir(orphan, { recursive: true })
    await fs.writeFile(join(orphan, 'leftover'), 'data')

    const summary = await runCleanup()
    expect(summary.orphans).toBe(1)

    await expect(fs.stat(orphan)).rejects.toThrow()
  })

  it('keeps the directory of a live transfer', async () => {
    const { transferId } = await seedTransfer({ expiresInHours: 48 })

    const summary = await runCleanup()
    expect(summary.orphans).toBe(0)
    expect(await transferDirExists(transferId)).toBe(true)
  })

  it('ignores anything that is not a transfer id', async () => {
    // Only directories that look like ids are this task's business; anything
    // else was put there by a person.
    const root = join(TEST_STORAGE, 'transfers')
    await fs.mkdir(join(root, 'notes'), { recursive: true })

    const summary = await runCleanup()
    expect(summary.orphans).toBe(0)
    await expect(fs.stat(join(root, 'notes'))).resolves.toBeDefined()
  })
})

describe('expired sessions and tokens', () => {
  it('deletes them once they lapse and keeps the live ones', async () => {
    const db = setupDatabase()
    const user = await createTestUser()

    await db.execute(
      'INSERT INTO `session` (`id`, `expiresAt`, `token`, `userId`) VALUES (?, DATE_SUB(NOW(), INTERVAL 1 HOUR), ?, ?)',
      ['expired-session', 'expired-token-value', user.id]
    )
    await db.execute(
      'INSERT INTO `session` (`id`, `expiresAt`, `token`, `userId`) VALUES (?, DATE_ADD(NOW(), INTERVAL 1 DAY), ?, ?)',
      ['live-session', 'live-token-value', user.id]
    )
    await db.execute(
      'INSERT INTO `verification` (`id`, `identifier`, `value`, `purpose`, `expiresAt`) VALUES (?, ?, ?, \'magic_link\', DATE_SUB(NOW(), INTERVAL 1 HOUR))',
      ['expired-token', user.email, 'value-1']
    )

    const summary = await runCleanup()
    expect(summary.sessions).toBe(1)
    expect(summary.tokens).toBe(1)

    const [sessions] = await db.execute<RowDataPacket[]>('SELECT id FROM `session`')
    expect(sessions.map((s: RowDataPacket) => s.id)).toEqual(['live-session'])
  })
})

describe('expiry warnings', () => {
  it('warns the sender once, inside the warning window', async () => {
    const { transferId } = await seedTransfer({
      expiresInHours: 12,
      sentHoursAgo: 60,
      senderEmail: 'sender@example.com'
    })

    const summary = await runCleanup()
    expect(summary.warned).toBe(1)
    expect(sentMail).toHaveLength(1)
    expect(sentMail[0]!.to).toBe('sender@example.com')
    expect(sentMail[0]!.subject).toContain('Test transfer')

    // The row records that it happened, which is what stops the next run — the
    // sweep fires every 15 minutes for the whole length of the window.
    const row = await getTransferRow(transferId)
    expect(row!.expiryWarningSentAt).not.toBeNull()

    sentMail.length = 0
    const second = await runCleanup()
    expect(second.warned).toBe(0)
    expect(sentMail).toHaveLength(0)
  })

  it('says nothing while expiry is still far off', async () => {
    await seedTransfer({ expiresInHours: 72, sentHoursAgo: 1 })

    const summary = await runCleanup()
    expect(summary.warned).toBe(0)
    expect(sentMail).toHaveLength(0)
  })

  it('skips a transfer whose whole life is shorter than the warning window', async () => {
    // A one-day transfer with a 24-hour lead time would otherwise be announced
    // as "expiring soon" the moment it was sent.
    await seedTransfer({ expiresInHours: 20, sentHoursAgo: 0 })

    const summary = await runCleanup()
    expect(summary.warned).toBe(0)
    expect(sentMail).toHaveLength(0)
  })

  it('never warns about a transfer with no expiry', async () => {
    await seedTransfer({ expiresInHours: null, sentHoursAgo: 60 })

    const summary = await runCleanup()
    expect(summary.warned).toBe(0)
  })

  it('does not warn about a draft, which was never delivered', async () => {
    await seedTransfer({ status: 'draft', expiresInHours: 12, createdHoursAgo: 1 })

    const summary = await runCleanup()
    expect(summary.warned).toBe(0)
    expect(sentMail).toHaveLength(0)
  })

  it('does not warn about something it just deleted', async () => {
    // Deletion runs first precisely so this can never happen.
    await seedTransfer({ expiresInHours: -1, sentHoursAgo: 60 })

    const summary = await runCleanup()
    expect(summary.expired).toBe(1)
    expect(summary.warned).toBe(0)
    expect(sentMail).toHaveLength(0)
  })

  it('tells a link-only sender that nobody was notified', async () => {
    await seedTransfer({ expiresInHours: 12, sentHoursAgo: 60, recipients: [] })

    await runCleanup()
    expect(sentMail).toHaveLength(1)
    expect(sentMail[0]!.html).toContain('link-only')
  })

  it('retries on the next run when the mail fails', async () => {
    const { sendEmail } = await import('../../app/lib/sendEmail')
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP unavailable'))

    const { transferId } = await seedTransfer({ expiresInHours: 12, sentHoursAgo: 60 })

    const first = await runCleanup()
    expect(first.warned).toBe(0)
    // Unmarked, so the one warning this transfer gets is not silently consumed.
    expect((await getTransferRow(transferId))!.expiryWarningSentAt).toBeNull()

    const second = await runCleanup()
    expect(second.warned).toBe(1)
    expect((await getTransferRow(transferId))!.expiryWarningSentAt).not.toBeNull()
  })

  it('warns about several transfers in one pass', async () => {
    await seedTransfer({ expiresInHours: 12, sentHoursAgo: 60, senderEmail: 'a@example.com' })
    await seedTransfer({ expiresInHours: 6, sentHoursAgo: 60, senderEmail: 'b@example.com' })

    const summary = await runCleanup()
    expect(summary.warned).toBe(2)
    expect(sentMail.map(m => m.to).sort()).toEqual(['a@example.com', 'b@example.com'])
  })
})
