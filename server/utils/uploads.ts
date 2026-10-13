import { promises as fs } from 'node:fs'
import type { H3Event } from 'h3'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { Pool } from 'mysql2/promise'
import { resolveStoredFile } from './storage'

// Resumable uploads: a file sent in pieces, any of which can be sent again.
//
// A single request for a multi-gigabyte file is all or nothing — a connection
// that drops at 2.9 GB of 3 costs the whole upload. Here the file arrives as a
// series of requests that each append to what is already on disk, so a failure
// costs one piece, and the client can ask how far the server got and carry on
// from exactly there.
//
//   POST   /api/transfers/:id/uploads             announce a file, get an upload id
//   PATCH  /api/transfers/:id/uploads/:uploadId   append bytes at `Upload-Offset`
//   GET    /api/transfers/:id/uploads/:uploadId   how many bytes have arrived
//   DELETE /api/transfers/:id/uploads/:uploadId   give up on it
//
// The single-request endpoint (`POST …/files`) stays as it is, for scripts that
// would rather send one file with one `curl`.

/**
 * The piece size the web interface is told to use. The server accepts pieces of
 * any size — this is advice, not a limit.
 *
 * Large enough that a 3 GB file is a couple of hundred requests rather than
 * thousands; small enough that a dropped connection costs seconds of upload, not
 * minutes, and that a proxy needs only a modest body limit to let it through.
 */
export const UPLOAD_CHUNK_SIZE = 16 * 1024 * 1024

export interface UploadRow {
  id: string
  transfer: number
  filename: string
  storedName: string
  mimeType: string
  size: number
  fileId: number | null
}

export interface UploadedFile {
  id: number
  filename: string
  mimeType: string
  size: number
}

/** The on-disk name of a file that has not finished arriving. */
export const partName = (storedName: string) => `${storedName}.part`

/**
 * Whether `userId` may upload into this transfer: it has to be their own, and
 * still a draft. Someone else's reads as missing, so ids cannot be probed.
 */
export async function checkOwnDraft(db: Pool, transferId: number, userId: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT senderId, status FROM `transfers` WHERE `id` = ?',
    [transferId]
  )
  const transfer = rows[0]

  if (!transfer || transfer.senderId !== userId) return { ok: false, status: 404, error: 'NOT_FOUND' } as const
  // Once sent, the file list is what the recipient was told they're getting.
  if (transfer.status !== 'draft') return { ok: false, status: 409, error: 'TRANSFER_ALREADY_SENT' } as const
  return { ok: true } as const
}

/** One upload of one transfer, or null. */
export async function loadUpload(db: Pool, transferId: number, uploadId: string): Promise<UploadRow | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, transfer, filename, storedName, mimeType, size, fileId FROM `transfer_uploads` WHERE `id` = ? AND `transfer` = ?',
    [uploadId, transferId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    transfer: Number(row.transfer),
    filename: String(row.filename),
    storedName: String(row.storedName),
    mimeType: String(row.mimeType),
    size: Number(row.size),
    fileId: row.fileId === null ? null : Number(row.fileId)
  }
}

/** Absolute path of an upload's partial file. */
export function partPath(upload: UploadRow, event?: H3Event): string | null {
  return resolveStoredFile(upload.transfer, partName(upload.storedName), event)
}

/**
 * How many bytes of an upload have arrived — read from the disk, never
 * remembered. After a write that was cut short this is the only number that is
 * certainly true.
 */
export async function uploadOffset(upload: UploadRow, event?: H3Event): Promise<number> {
  if (upload.fileId !== null) return upload.size
  const path = partPath(upload, event)
  if (!path) return 0
  try {
    return (await fs.stat(path)).size
  } catch {
    return 0
  }
}

/**
 * How many of a transfer's file slots are taken: the files it has, plus the
 * ones still arriving. Counting only finished files would let fifty uploads be
 * started against a transfer that already holds fifty.
 */
export async function countFileSlots(db: Pool, transferId: number): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM \`transfer_files\` WHERE \`transfer\` = ?)
       + (SELECT COUNT(*) FROM \`transfer_uploads\` WHERE \`transfer\` = ? AND \`fileId\` IS NULL) AS count`,
    [transferId, transferId]
  )
  return Number(rows[0]?.count ?? 0)
}

/** How many of a transfer's uploads have not finished arriving. */
export async function countIncompleteUploads(db: Pool, transferId: number): Promise<number> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM `transfer_uploads` WHERE `transfer` = ? AND `fileId` IS NULL',
    [transferId]
  )
  return Number(rows[0]?.count ?? 0)
}

/** The finished file an upload turned into. */
export async function loadUploadedFile(db: Pool, upload: UploadRow): Promise<UploadedFile | null> {
  if (upload.fileId === null) return null
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, filename, mimeType, size FROM `transfer_files` WHERE `id` = ?',
    [upload.fileId]
  )
  const row = rows[0]
  if (!row) return null
  return { id: Number(row.id), filename: String(row.filename), mimeType: String(row.mimeType), size: Number(row.size) }
}

// One writer per upload. Two requests appending to the same file would
// interleave their bytes, and the usual way to get two is innocent: a client
// whose connection dropped retries while the server is still finishing with the
// request it thinks is dead. The second one is told to wait rather than let in.
const writing = new Set<string>()

/** Claim an upload for writing. Returns the release function, or null if taken. */
export function lockUpload(uploadId: string): (() => void) | null {
  if (writing.has(uploadId)) return null
  writing.add(uploadId)
  return () => {
    writing.delete(uploadId)
  }
}

/**
 * Turn a fully arrived upload into a file of the transfer.
 *
 * The rename comes first. If the insert after it fails there is a file on disk
 * with no row, which the sweep of abandoned drafts removes; the other order
 * could leave a row pointing at a file that was never put in place.
 */
export async function completeUpload(db: Pool, upload: UploadRow, event?: H3Event): Promise<UploadedFile> {
  const from = partPath(upload, event)
  const to = resolveStoredFile(upload.transfer, upload.storedName, event)
  if (!from || !to) throw new Error('UPLOAD_PATH_INVALID')

  await fs.rename(from, to)

  const [insert] = await db.execute<ResultSetHeader>(
    'INSERT INTO `transfer_files` (`transfer`, `filename`, `storedName`, `mimeType`, `size`) VALUES (?, ?, ?, ?, ?)',
    [upload.transfer, upload.filename, upload.storedName, upload.mimeType, upload.size]
  )
  const fileId = Number(insert.insertId)
  await db.execute('UPDATE `transfer_uploads` SET `fileId` = ? WHERE `id` = ?', [fileId, upload.id])

  return { id: fileId, filename: upload.filename, mimeType: upload.mimeType, size: upload.size }
}

/** Give up on an unfinished upload: its partial file and its row. */
export async function discardUpload(db: Pool, upload: UploadRow, event?: H3Event): Promise<void> {
  const path = partPath(upload, event)
  if (path) await fs.rm(path, { force: true })
  await db.execute('DELETE FROM `transfer_uploads` WHERE `id` = ? AND `fileId` IS NULL', [upload.id])
}
