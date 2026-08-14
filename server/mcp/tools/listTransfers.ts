import type { RowDataPacket } from 'mysql2'
import { z } from 'zod'
import { setupDatabase } from '../../../app/lib/databaseSetup'
import type { SerializableTransfer } from '../../utils/mcpHelpers'
import { appUrl, requireMcpUser, serializeTransfer } from '../../utils/mcpHelpers'

export default defineMcpTool({
  name: 'listTransfers',
  title: 'List transfers',
  description:
    'List the transfers the user sent, or the ones sent to them. Returns ids, subjects, status, '
    + 'recipients, sizes and expiry. Use `getTransfer` for the file list of one transfer.',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    direction: z
      .enum(['sent', 'received'])
      .optional()
      .describe('Which side to list. Defaults to "sent".'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('How many to return, newest first. Defaults to 25.')
  },
  inputExamples: [{}, { direction: 'received', limit: 10 }],
  handler: async ({ direction = 'sent', limit = 25 }) => {
    const user = requireMcpUser()
    const db = setupDatabase()
    const base = appUrl()

    // Interpolated rather than bound: MySQL rejects a placeholder for LIMIT in a
    // prepared statement. Safe because zod has already reduced it to an integer
    // between 1 and 100 — but clamped again here so that stays true if the schema
    // ever loosens.
    const rowLimit = Math.min(100, Math.max(1, Math.trunc(limit)))

    // `received` matches on e-mail rather than user id: a transfer can be
    // addressed to someone before they have an account, or by an outside sender
    // who only ever knew the address.
    const [rows] = direction === 'received'
      ? await db.execute<RowDataPacket[]>(
          `SELECT t.id, t.token, t.subject, t.status, t.kind, t.layout, t.expiresAt,
                  t.sentAt, t.createdAt, t.senderName, t.senderEmail,
                  (t.passwordHash IS NOT NULL) AS hasPassword,
                  (SELECT COUNT(*) FROM transfer_files f WHERE f.transfer = t.id) AS fileCount,
                  (SELECT COALESCE(SUM(f.size), 0) FROM transfer_files f WHERE f.transfer = t.id) AS totalSize
           FROM transfers t
           JOIN transfer_recipients r ON r.transfer = t.id
           WHERE r.email = ? AND t.status = 'sent'
           ORDER BY t.sentAt DESC
           LIMIT ${rowLimit}`,
          [user.email]
        )
      : await db.execute<RowDataPacket[]>(
          `SELECT t.id, t.token, t.subject, t.status, t.kind, t.layout, t.expiresAt,
                  t.downloadCount, t.sentAt, t.createdAt,
                  (t.passwordHash IS NOT NULL) AS hasPassword,
                  (SELECT COUNT(*) FROM transfer_files f WHERE f.transfer = t.id) AS fileCount,
                  (SELECT COALESCE(SUM(f.size), 0) FROM transfer_files f WHERE f.transfer = t.id) AS totalSize,
                  (SELECT GROUP_CONCAT(r.email SEPARATOR ', ') FROM transfer_recipients r WHERE r.transfer = t.id) AS recipients
           FROM transfers t
           WHERE t.senderId = ?
           ORDER BY t.createdAt DESC
           LIMIT ${rowLimit}`,
          [user.id]
        )

    return jsonResult({
      direction,
      count: rows.length,
      transfers: rows.map((row: RowDataPacket) => ({
        ...serializeTransfer(row as SerializableTransfer, base),
        ...(direction === 'received'
          ? { from: { name: row.senderName, email: row.senderEmail } }
          : {})
      }))
    })
  }
})
