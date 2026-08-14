import type { RowDataPacket } from 'mysql2'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import { fail, requireUser } from '../../utils/auth'
import { logger } from '../../utils/logger'

// The signed-in user's transfers: what they sent, and what was sent to them.
//
// "Received" is matched on the recipient's e-mail rather than a user id, because
// a member can be a recipient of a transfer created before their account existed,
// or addressed by an outside sender who only knows the address.
export default defineEventHandler(async (event) => {
  const auth = await requireUser(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const db = setupDatabase()

    const [sent] = await db.execute<RowDataPacket[]>(
      `SELECT
         t.id, t.token, t.subject, t.status, t.kind, t.retentionDays, t.expiresAt,
         t.downloadCount, t.lastDownloadAt, t.createdAt, t.sentAt, t.layout,
         (t.passwordHash IS NOT NULL) AS hasPassword,
         (SELECT COUNT(*) FROM transfer_files f WHERE f.transfer = t.id) AS fileCount,
         (SELECT COALESCE(SUM(f.size), 0) FROM transfer_files f WHERE f.transfer = t.id) AS totalSize,
         (SELECT GROUP_CONCAT(r.email SEPARATOR ', ') FROM transfer_recipients r WHERE r.transfer = t.id) AS recipients
       FROM transfers t
       WHERE t.senderId = ?
       ORDER BY t.createdAt DESC
       LIMIT 200`,
      [auth.user.id]
    )

    const [received] = await db.execute<RowDataPacket[]>(
      `SELECT
         t.id, t.token, t.subject, t.status, t.kind, t.expiresAt,
         t.senderName, t.senderEmail, t.sentAt,
         (SELECT COUNT(*) FROM transfer_files f WHERE f.transfer = t.id) AS fileCount,
         (SELECT COALESCE(SUM(f.size), 0) FROM transfer_files f WHERE f.transfer = t.id) AS totalSize
       FROM transfers t
       JOIN transfer_recipients r ON r.transfer = t.id
       WHERE r.email = ? AND t.status = 'sent'
       ORDER BY t.sentAt DESC
       LIMIT 200`,
      [auth.user.email]
    )

    const shape = (row: RowDataPacket) => ({
      ...row,
      hasPassword: !!row.hasPassword,
      fileCount: Number(row.fileCount),
      totalSize: Number(row.totalSize),
      downloadCount: row.downloadCount === undefined ? undefined : Number(row.downloadCount)
    })

    return {
      data: {
        sent: sent.map(shape),
        received: received.map(shape)
      }
    }
  } catch (error) {
    logger.error('List transfers error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
