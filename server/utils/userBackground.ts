import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { H3Event } from 'h3'
import type { Pool } from 'mysql2/promise'
import type { SessionUser } from './auth'
import { ensureTransferDir, generateStoredName, resolveUserFile } from './storage'
import { logger } from './logger'

// A member's default background: set once in the account settings, carried by
// every transfer they send unless that transfer is given another image.

/**
 * The URL the interface loads a member's default background from, or null.
 *
 * Versioned by the stored name, which changes on every upload: the image is
 * served cacheable for an hour, so an unversioned URL would keep showing the old
 * picture after it had been replaced.
 */
export function defaultBackgroundUrl(storedName: string | null | undefined): string | null {
  return storedName ? `/api/account/background?v=${storedName.replace(/^bg_/, '').slice(0, 12)}` : null
}

/**
 * Put the sender's default background on a new transfer, and report whether it
 * did.
 *
 * The transfer gets a file of its own inside its own directory, exactly as if
 * the image had been uploaded for it. That keeps the rest of the app unaware of
 * defaults — the download page, expiry and deletion all see an ordinary
 * per-transfer background — and it means a transfer keeps the background it was
 * sent with when the default is later replaced or removed.
 *
 * A hard link rather than a copy, so a default on a hundred transfers is still
 * one image on disk; the link survives the original being deleted. Where the
 * filesystem can't link, it copies.
 *
 * Best-effort: a transfer that goes out without its decoration is far better
 * than one that fails over it.
 */
export async function applyDefaultBackground(
  db: Pool,
  transferId: number,
  user: SessionUser,
  event?: H3Event
): Promise<boolean> {
  if (user.type !== 'member' || !user.backgroundName) return false

  const source = resolveUserFile(user.id, user.backgroundName, event)
  if (!source) return false

  try {
    const dir = await ensureTransferDir(transferId, event)
    const name = `bg_${generateStoredName()}`
    const target = join(dir, name)

    try {
      await fs.link(source, target)
    } catch (error) {
      // Gone is gone; anything else is the filesystem declining a link.
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') throw error
      await fs.copyFile(source, target)
    }

    await db.execute('UPDATE `transfers` SET `backgroundName` = ? WHERE `id` = ?', [name, transferId])
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.error('Failed to apply the default background', { transferId, error })
    }
    return false
  }
}
