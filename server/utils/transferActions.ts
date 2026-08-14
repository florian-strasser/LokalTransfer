import type { H3Event } from 'h3'
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { sendEmail } from '../../app/lib/sendEmail'
import type { SessionUser } from './auth'
import {
  emailContext,
  renderGuestTransferEmail,
  renderReceiptEmail,
  renderTransferEmail
} from './emailTemplates'
import { generateTransferToken, loadTransferFiles, loadTransferRecipients } from './transfers'
import { retentionToExpiry } from './validation'
import { logger } from './logger'

// The transfer operations themselves, independent of how they were requested.
//
// There are now two front doors — the REST endpoints the web UI calls, and the
// MCP tools an agent calls — and "send a transfer" has to mean exactly the same
// thing through both. Anything that only lived in the HTTP handler would quietly
// not happen over MCP: the retention clock, the receipt mail, the reply-to.
//
// Request-shaped concerns stay with the callers. Validation, authorization and
// error formatting differ (status codes vs. McpError), so each front door does
// its own and hands the result down.

export interface TransferRecipientInput {
  userId: string | null
  email: string
  name: string | null
}

export interface CreateTransferDraftOptions {
  user: SessionUser
  kind: 'outgoing' | 'guest'
  subject: string | null
  message: string | null
  retentionDays: number
  layout: string
  passwordHash: string | null
  recipients: TransferRecipientInput[]
}

/**
 * Insert a draft transfer and its recipients in one transaction.
 *
 * Values arriving here are already validated — this is the write, not the gate.
 * The expiry computed now is provisional; `sendTransferById` rewrites it so the
 * countdown starts on delivery rather than on upload.
 */
export async function createTransferDraft(
  db: Pool,
  options: CreateTransferDraftOptions
): Promise<{ transferId: number, token: string, expiresAt: Date | null }> {
  const token = generateTransferToken()
  const expiresAt = retentionToExpiry(options.retentionDays)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO \`transfers\`
       (\`token\`, \`senderId\`, \`senderName\`, \`senderEmail\`, \`kind\`, \`subject\`, \`message\`, \`status\`, \`retentionDays\`, \`expiresAt\`, \`passwordHash\`, \`layout\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [
        token,
        options.user.id,
        options.user.name,
        options.user.email,
        options.kind,
        options.subject,
        options.message,
        options.retentionDays,
        expiresAt,
        options.passwordHash,
        options.layout
      ]
    )
    const transferId = Number(result.insertId)

    for (const recipient of options.recipients) {
      await conn.execute(
        'INSERT INTO `transfer_recipients` (`transfer`, `userId`, `email`, `name`) VALUES (?, ?, ?, ?)',
        [transferId, recipient.userId, recipient.email, recipient.name]
      )
    }

    await conn.commit()
    return { transferId, token, expiresAt }
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

// A send either goes through or fails for one of a handful of reasons the caller
// has to distinguish — a draft with no files is a different answer than someone
// else's transfer. Returned as a discriminated union so each front door can map
// the reason onto its own error vocabulary.
export type SendTransferResult
  = | {
    ok: true
    transferId: number
    token: string
    downloadUrl: string
    expiresAt: Date | null
    recipientCount: number
    notified: number
  }
  | { ok: false, reason: 'NOT_FOUND' | 'ALREADY_SENT' | 'NO_FILES' }

/**
 * Finalise a draft: make it downloadable, start the retention clock, notify
 * everyone involved.
 *
 * Mail is best-effort. Once the row says `sent` the files are live, so a refused
 * SMTP connection is reported through `notified` rather than rolled back —
 * undoing a completed upload because a mail server hiccuped would be the worse
 * failure. The caller decides whether a shortfall is worth mentioning.
 */
export async function sendTransferById(
  event: H3Event,
  db: Pool,
  transferId: number,
  user: SessionUser
): Promise<SendTransferResult> {
  const [transfers] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM `transfers` WHERE `id` = ?',
    [transferId]
  )
  const transfer = transfers[0]

  if (!transfer || transfer.senderId !== user.id) return { ok: false, reason: 'NOT_FOUND' }

  // Idempotent: a double-click on Send, or a retrying agent, shouldn't mail
  // everyone twice.
  if (transfer.status !== 'draft') return { ok: false, reason: 'ALREADY_SENT' }

  const files = await loadTransferFiles(db, transferId)
  if (files.length === 0) return { ok: false, reason: 'NO_FILES' }

  // An empty recipient list is valid: a link-only transfer the sender shares
  // themselves. Nothing is e-mailed for those — not even a receipt.
  const recipients = await loadTransferRecipients(db, transferId)
  const isLinkOnly = recipients.length === 0

  // The retention clock starts now rather than at creation: an upload that took
  // an hour shouldn't eat an hour of the recipient's download window.
  const expiresAt = retentionToExpiry(Number(transfer.retentionDays) || 0)

  await db.execute(
    'UPDATE `transfers` SET `status` = \'sent\', `sentAt` = CURRENT_TIMESTAMP, `expiresAt` = ? WHERE `id` = ? AND `status` = \'draft\'',
    [expiresAt, transferId]
  )

  const ctx = emailContext(event)
  const downloadUrl = `${ctx.appUrl}/d/${transfer.token}`

  let notified = 0
  for (const recipient of recipients) {
    try {
      const rendered
        = transfer.kind === 'guest'
          ? renderGuestTransferEmail(ctx, {
              senderName: transfer.senderName,
              senderEmail: transfer.senderEmail,
              senderCompany: user.company,
              subject: transfer.subject,
              message: transfer.message,
              files,
              downloadUrl,
              expiresAt
            })
          : renderTransferEmail(ctx, {
              senderName: transfer.senderName,
              subject: transfer.subject,
              message: transfer.message,
              files,
              downloadUrl,
              expiresAt
            })

      await sendEmail({
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        // Replies go to the person who sent the files, not to the system
        // mailbox — which is what a recipient will try to do first.
        replyTo: transfer.senderEmail
      })

      await db.execute(
        'UPDATE `transfer_recipients` SET `notifiedAt` = CURRENT_TIMESTAMP WHERE `id` = ?',
        [recipient.id]
      )
      notified++
    } catch (mailError) {
      logger.error('Transfer notification failed', {
        transferId,
        recipient: recipient.email,
        error: mailError
      })
    }
  }

  // Confirmation to the sender, with the link, so they have their own copy.
  // Skipped for a link-only transfer: nothing was delivered to anyone, and the
  // sender already has the link in front of them.
  if (!isLinkOnly) {
    try {
      const receipt = renderReceiptEmail(ctx, {
        recipients: recipients.map((r: RowDataPacket) => r.email),
        files,
        transferUrl: downloadUrl,
        expiresAt
      })
      await sendEmail({
        to: transfer.senderEmail,
        subject: receipt.subject,
        html: receipt.html
      })
    } catch (mailError) {
      logger.error('Transfer receipt failed', { transferId, error: mailError })
    }
  }

  return {
    ok: true,
    transferId,
    token: transfer.token,
    downloadUrl,
    expiresAt,
    recipientCount: recipients.length,
    notified
  }
}
