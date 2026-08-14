import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { removeTransferDir } from './storage'
import { logger } from './logger'

/**
 * The public token in a download URL.
 *
 * 32 random bytes (256 bits) rendered as hex. This is the *only* thing standing
 * between a stranger and the files, so it has to be unguessable on its own —
 * there is no second factor on a download link, by design, because recipients
 * are people with no account here.
 */
export function generateTransferToken(): string {
  return randomBytes(32).toString('hex')
}

export interface TransferRow {
  id: number
  token: string
  senderId: string | null
  senderName: string
  senderEmail: string
  kind: 'outgoing' | 'guest'
  subject: string | null
  message: string | null
  status: 'draft' | 'sent'
  retentionDays: number | null
  expiresAt: Date | null
  downloadCount: number
  createdAt: Date
  sentAt: Date | null
}

/** Whether a transfer has passed its expiry. Unlimited transfers never have. */
export function isExpired(transfer: { expiresAt: Date | string | null }): boolean {
  if (!transfer.expiresAt) return false
  return new Date(transfer.expiresAt).getTime() <= Date.now()
}

/**
 * Delete transfers completely: files from disk first, then the rows.
 *
 * Order matters. Removing the directories first means a crash halfway through
 * leaves rows pointing at missing files — which the download handler already
 * treats as "gone" — whereas deleting the rows first would leave files on disk
 * that nothing references any more and nothing will ever clean up.
 *
 * Used by the scheduled expiry sweep, by manual deletion, and when an account is
 * removed.
 */
export async function deleteTransfers(db: Pool, transferIds: number[], event?: H3Event) {
  if (transferIds.length === 0) return { deleted: 0 }

  for (const id of transferIds) {
    await removeTransferDir(id, event)
  }

  // Built from integers that have already been through the database as ids, and
  // MySQL doesn't accept an array for a single `?` placeholder in IN (...).
  const placeholders = transferIds.map(() => '?').join(', ')

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `DELETE FROM \`transfer_files\` WHERE \`transfer\` IN (${placeholders})`,
      transferIds
    )
    await conn.execute(
      `DELETE FROM \`transfer_recipients\` WHERE \`transfer\` IN (${placeholders})`,
      transferIds
    )
    await conn.execute(`DELETE FROM \`transfers\` WHERE \`id\` IN (${placeholders})`, transferIds)
    await conn.commit()
  } catch (error) {
    await conn.rollback()
    logger.error('Failed to delete transfer rows', error)
    throw error
  } finally {
    conn.release()
  }

  return { deleted: transferIds.length }
}

export interface TransferFile {
  id: number
  filename: string
  storedName: string
  mimeType: string
  size: number
}

/** Load a transfer's files, in upload order. */
export async function loadTransferFiles(db: Pool, transferId: number): Promise<TransferFile[]> {
  const [files] = await db.execute<RowDataPacket[]>(
    'SELECT id, filename, storedName, mimeType, size FROM `transfer_files` WHERE `transfer` = ? ORDER BY `id` ASC',
    [transferId]
  )
  return files.map((file: RowDataPacket) => ({
    id: Number(file.id),
    filename: file.filename,
    storedName: file.storedName,
    mimeType: file.mimeType,
    // BIGINT comes back from mysql2 as a string once it exceeds the safe integer
    // range; Number() keeps the API shape consistent for the sizes we allow.
    size: Number(file.size)
  }))
}

/** Load a transfer's recipients. */
export async function loadTransferRecipients(db: Pool, transferId: number) {
  const [recipients] = await db.execute<RowDataPacket[]>(
    'SELECT id, userId, email, name, notifiedAt FROM `transfer_recipients` WHERE `transfer` = ? ORDER BY `id` ASC',
    [transferId]
  )
  return recipients
}
