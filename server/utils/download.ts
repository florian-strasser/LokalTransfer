import type { RowDataPacket } from 'mysql2'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie, type H3Event } from 'h3'
import { setupDatabase } from '../../app/lib/databaseSetup'
import { isDownloadToken } from './validation'
import { isExpired, loadTransferFiles, type TransferFile } from './transfers'

// Shared resolution for the public download routes.
//
// Every one of them — the metadata endpoint, single-file download and the zip —
// has to make exactly the same three checks, and a mismatch between them would be
// the kind of bug where one route keeps serving files the others consider
// expired. So the checks live here once.

export type DownloadResolution
  = | { ok: true, transfer: RowDataPacket, files: TransferFile[] }
    | { ok: false, status: number, error: string }

/**
 * Resolve a download token to a live transfer.
 *
 * An expired, draft or unknown token all return the same 404. Distinguishing
 * them would tell whoever is holding an old link whether it ever existed, and
 * "this expired two days ago" is not information a stranger is owed.
 */
export async function resolveDownload(token: unknown): Promise<DownloadResolution> {
  if (!isDownloadToken(token)) {
    return { ok: false, status: 404, error: 'NOT_FOUND' }
  }

  const db = setupDatabase()
  const [transfers] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM `transfers` WHERE `token` = ? AND `status` = \'sent\'',
    [token]
  )
  const transfer = transfers[0]

  if (!transfer) {
    return { ok: false, status: 404, error: 'NOT_FOUND' }
  }

  // The scheduled sweep deletes expired transfers, but this check is what makes
  // expiry exact: between two sweeps a transfer is already unreachable, so the
  // guarantee doesn't depend on how often the task runs.
  if (isExpired({ expiresAt: transfer.expiresAt })) {
    return { ok: false, status: 404, error: 'NOT_FOUND' }
  }

  const files = await loadTransferFiles(db, transfer.id)

  return { ok: true, transfer, files }
}

/** Record that a transfer was downloaded. Best-effort; never blocks the stream. */
export async function recordDownload(transferId: number) {
  const db = setupDatabase()
  await db
    .execute(
      'UPDATE `transfers` SET `downloadCount` = `downloadCount` + 1, `lastDownloadAt` = CURRENT_TIMESTAMP WHERE `id` = ?',
      [transferId]
    )
    .catch(() => {})
}

/**
 * Build a `Content-Disposition` value that survives non-ASCII filenames.
 *
 * Two forms are sent: a stripped ASCII fallback for old clients, and RFC 5987
 * `filename*` with the real UTF-8 name for everything current. Quotes and
 * backslashes are removed rather than escaped, since a filename containing them
 * is far more likely to be an injection attempt than a real name.
 */
// --- Password-protected transfers -------------------------------------------
//
// A protected transfer needs recipients to prove they know the password on every
// subsequent request, and those recipients have no account here — so a normal
// session is not available.
//
// Instead, unlocking sets a cookie holding an HMAC of the transfer's identity,
// keyed by the transfer's own bcrypt hash. That hash never leaves the server, so
// the value can't be forged, and no global signing secret has to be introduced
// and kept stable across deploys. It also means changing a transfer's password
// invalidates every existing unlock for free, because the key changed.

/** Cookie name for one transfer. Scoped per transfer so unlocks don't leak across them. */
function unlockCookieName(transferId: number): string {
  return `lt_unlock_${transferId}`
}

/** Path the unlock cookie is valid for — its own transfer's API routes only. */
function unlockCookiePath(token: string): string {
  return `/api/download/${token}`
}

function unlockValue(transfer: RowDataPacket): string {
  return createHmac('sha256', String(transfer.passwordHash))
    .update(`${transfer.id}:${transfer.token}`)
    .digest('hex')
}

/** Whether this request may see a protected transfer's contents. */
export function isUnlocked(event: H3Event, transfer: RowDataPacket): boolean {
  // Not protected at all — the token is the only credential.
  if (!transfer.passwordHash) return true

  const provided = getCookie(event, unlockCookieName(transfer.id))
  if (!provided) return false

  const expected = unlockValue(transfer)
  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')

  // Length is checked first because timingSafeEqual throws on a mismatch; the
  // lengths are fixed by the digest, so this leaks nothing.
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Grant this browser access to a protected transfer. */
export function setUnlockCookie(event: H3Event, transfer: RowDataPacket) {
  const isSecureContext
    = process.env.NODE_ENV === 'production'
      || process.env.SSL === 'true'
      || getRequestHeader(event, 'x-forwarded-proto') === 'https'

  setCookie(event, unlockCookieName(transfer.id), unlockValue(transfer), {
    httpOnly: true,
    secure: isSecureContext,
    sameSite: 'lax',
    // Long enough to browse a gallery and download everything without
    // re-entering the password, short enough that a shared computer doesn't stay
    // unlocked indefinitely.
    maxAge: 12 * 60 * 60,
    path: unlockCookiePath(String(transfer.token))
  })
}

export function contentDisposition(filename: string): string {
  const fallback = filename

    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '')
    || 'download'

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
