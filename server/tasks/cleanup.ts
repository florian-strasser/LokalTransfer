import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { Pool } from 'mysql2/promise'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { sendEmail } from '../../app/lib/sendEmail'
import { deleteTransfers, loadTransferFiles, loadTransferRecipients } from '../utils/transfers'
import { emailContext, renderExpiryWarningEmail } from '../utils/emailTemplates'
import { storageRoot } from '../utils/storage'
import { logger } from '../utils/logger'

// The scheduled sweep that makes retention real.
//
// Expiry is enforced in two places on purpose. The download routes refuse an
// expired transfer the moment it lapses, so the promise made to the sender holds
// exactly. This task is what actually reclaims the disk and removes the rows,
// which is the part that has to happen for "the files are deleted from the
// server" to be true rather than merely "the files are unreachable".
//
// Runs every 15 minutes (see nitro.scheduledTasks in nuxt.config.ts).

export default defineTask({
  meta: {
    name: 'cleanup',
    description: 'Delete expired transfers, abandoned drafts and stale tokens'
  },

  async run() {
    const db = setupDatabase()
    const config = useRuntimeConfig()

    const summary = { expired: 0, warned: 0, drafts: 0, sessions: 0, tokens: 0, orphans: 0 }

    try {
      // --- Expired transfers -------------------------------------------------
      // `expiresAt IS NULL` is the unlimited-retention case and is skipped, which
      // is why NULL was chosen over a far-future sentinel date.
      const [expired] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM `transfers` WHERE `expiresAt` IS NOT NULL AND `expiresAt` <= NOW()'
      )
      if (expired.length > 0) {
        await deleteTransfers(db, expired.map((row: RowDataPacket) => Number(row.id)))
        summary.expired = expired.length
      }

      // --- Expiry warnings ---------------------------------------------------
      // Deliberately after the deletion step: a transfer that has already lapsed
      // is gone by now, so this can never warn about something that no longer
      // exists.
      summary.warned = await sendExpiryWarnings(db, Number(config.expiryWarningHours))

      // --- Abandoned drafts --------------------------------------------------
      // A draft is a transfer whose upload started and never finished — the tab
      // was closed, the connection dropped. Its files are already on disk but
      // nothing will ever reference them, so they are swept after a grace period
      // long enough not to interrupt a genuinely slow upload.
      const draftHours = Number(config.draftMaxAgeHours) || 24
      const [drafts] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM `transfers` WHERE `status` = \'draft\' AND `createdAt` < DATE_SUB(NOW(), INTERVAL ? HOUR)',
        [draftHours]
      )
      if (drafts.length > 0) {
        await deleteTransfers(db, drafts.map((row: RowDataPacket) => Number(row.id)))
        summary.drafts = drafts.length
      }

      // --- Expired sessions and one-time tokens ------------------------------
      // Neither is honoured past its expiry, so this is housekeeping rather than
      // a security control — but an unbounded session table is its own problem.
      const [sessions] = await db.execute<ResultSetHeader>('DELETE FROM `session` WHERE `expiresAt` <= NOW()')
      summary.sessions = sessions.affectedRows || 0

      const [tokens] = await db.execute<ResultSetHeader>(
        'DELETE FROM `verification` WHERE `expiresAt` <= NOW()'
      )
      summary.tokens = tokens.affectedRows || 0

      // --- Orphaned directories ----------------------------------------------
      summary.orphans = await removeOrphanedDirectories(db)

      const total = Object.values(summary).reduce((sum, count) => sum + count, 0)
      if (total > 0) logger.info('Cleanup finished', summary)

      return { result: summary }
    } catch (error) {
      logger.error('Cleanup task failed', error)
      // Rethrowing would mark the scheduled run as failed but change nothing;
      // the next run in 15 minutes retries from wherever this one stopped, since
      // every step is driven by the current database state.
      return { result: { ...summary, failed: true } }
    }
  }
})

/**
 * Warn senders whose transfers are about to lapse.
 *
 * Selection is driven entirely by the current database state, so a run that dies
 * halfway simply picks up the rest next time. Three conditions matter:
 *
 * - `expiryWarningSentAt IS NULL` makes it fire once. Without it the sweep would
 *   re-send every 15 minutes for the whole length of the warning window.
 * - `expiresAt > NOW()` keeps it from warning about something already expired,
 *   which would be a lie by the time it arrived.
 * - The lifetime check skips transfers whose entire retention is shorter than
 *   the lead time. A 1-day transfer with a 24-hour warning would otherwise be
 *   announced as "expiring soon" the moment it was sent.
 *
 * The mail is best-effort per transfer: one sender's bounced warning must not
 * stop the others, and it must not mark the row as warned either, so a transient
 * SMTP failure is retried on the next run.
 */
async function sendExpiryWarnings(db: Pool, warningHours: number): Promise<number> {
  if (!Number.isFinite(warningHours) || warningHours <= 0) return 0

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, token, subject, senderEmail, expiresAt, sentAt, downloadCount
     FROM \`transfers\`
     WHERE \`status\` = 'sent'
       AND \`expiresAt\` IS NOT NULL
       AND \`expiryWarningSentAt\` IS NULL
       AND \`expiresAt\` > NOW()
       AND \`expiresAt\` <= DATE_ADD(NOW(), INTERVAL ? HOUR)
       AND \`expiresAt\` > DATE_ADD(\`sentAt\`, INTERVAL ? HOUR)`,
    [warningHours, warningHours]
  )

  if (rows.length === 0) return 0

  // No H3 event here — this runs on a timer, not a request — so the context is
  // built from runtimeConfig alone. That is why emailContext takes an optional
  // event rather than requiring one.
  const ctx = emailContext()
  let sent = 0

  for (const transfer of rows) {
    const transferId = Number(transfer.id)
    try {
      const files = await loadTransferFiles(db, transferId)
      // A sent transfer always has files, but if a partial delete ever left one
      // without any, warning that it is about to be deleted is pointless.
      if (files.length === 0) continue

      const recipients = await loadTransferRecipients(db, transferId)

      const rendered = renderExpiryWarningEmail(ctx, {
        subject: transfer.subject,
        recipients: recipients.map((r: RowDataPacket) => r.email),
        files,
        downloadUrl: `${ctx.appUrl}/d/${transfer.token}`,
        expiresAt: new Date(transfer.expiresAt),
        sentAt: new Date(transfer.sentAt),
        downloadCount: Number(transfer.downloadCount) || 0
      })

      await sendEmail({
        to: transfer.senderEmail,
        subject: rendered.subject,
        html: rendered.html
      })

      // Only after the mail is away, so a failure is retried rather than
      // silently swallowing the one warning this transfer gets.
      await db.execute(
        'UPDATE `transfers` SET `expiryWarningSentAt` = CURRENT_TIMESTAMP WHERE `id` = ?',
        [transferId]
      )
      sent++
    } catch (error) {
      logger.error('Expiry warning failed', { transferId, error })
    }
  }

  return sent
}

/**
 * Remove storage directories with no matching transfer row.
 *
 * These are the residue of a crash between deleting rows and deleting files, or
 * of a database restored from a backup older than the disk. Without this they
 * would occupy space forever, invisible to every other query. Deliberately the
 * last step and failure-tolerant: it is a nicety, not a correctness requirement.
 */
async function removeOrphanedDirectories(db: Pool): Promise<number> {
  const root = join(storageRoot(), 'transfers')

  let entries: string[]
  try {
    entries = await fs.readdir(root)
  } catch {
    // No storage directory yet — nothing has been uploaded on this instance.
    return 0
  }

  if (entries.length === 0) return 0

  const [rows] = await db.execute<RowDataPacket[]>('SELECT id FROM `transfers`')
  const live = new Set(rows.map((row: RowDataPacket) => String(row.id)))

  let removed = 0
  for (const entry of entries) {
    // Only touch directories that look like transfer ids. Anything else was put
    // there by a human and is not this task's business to delete.
    if (!/^\d+$/.test(entry) || live.has(entry)) continue

    try {
      await fs.rm(join(root, entry), { recursive: true, force: true })
      removed++
    } catch (error) {
      logger.error('Failed to remove orphaned directory', { entry, error })
    }
  }

  return removed
}
