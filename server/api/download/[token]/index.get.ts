import { isUnlocked, resolveDownload } from '../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../utils/rateLimit'
import { detectImageMime } from '../../../utils/images'
import { resolveStoredFile } from '../../../utils/storage'
import { logger } from '../../../utils/logger'

// Public metadata for a download link: who sent it, what's in it, when it goes.
//
// No session required — recipients are people with no account here, and the token
// is the credential. Only what a recipient needs is returned; notably not the
// full recipient list, so one recipient can't harvest the others' addresses.
export default defineEventHandler(async (event) => {
  if (!enforceRateLimit(event, downloadLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  try {
    const resolution = await resolveDownload(getRouterParam(event, 'token'))

    if (!resolution.ok) {
      setResponseStatus(event, resolution.status)
      return { error: resolution.error }
    }

    const { transfer, files } = resolution

    // The presentation details are safe to reveal before unlocking — they're what
    // the page needs to render the password prompt in the right style, and they
    // say nothing about the contents.
    const shell = {
      layout: transfer.layout || 'list',
      hasBackground: !!transfer.backgroundName,
      requiresPassword: !!transfer.passwordHash
    }

    // Locked: return the shell only. No filenames, no sizes, no sender name — a
    // file list is often as sensitive as the files, and leaking it would make the
    // password pointless.
    if (!isUnlocked(event, transfer)) {
      return { data: { ...shell, locked: true } }
    }

    // Only sniffed once the transfer is unlocked, so a locked link can't be used
    // to probe what kind of files are inside.
    const previewable = await Promise.all(
      files.map(async (file) => {
        // The gallery only renders what is genuinely an image; the flag comes
        // from the file's own bytes, never from the uploader's declared type.
        const path = resolveStoredFile(transfer.id, file.storedName, event)
        return path ? (await detectImageMime(path)) !== null : false
      })
    )

    return {
      data: {
        ...shell,
        locked: false,
        senderName: transfer.senderName,
        subject: transfer.subject,
        message: transfer.message,
        sentAt: transfer.sentAt,
        expiresAt: transfer.expiresAt,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        files: files.map((file, index) => ({
          id: file.id,
          filename: file.filename,
          size: file.size,
          isImage: previewable[index]
        }))
      }
    }
  } catch (error) {
    logger.error('Download metadata error', error)
    setResponseStatus(event, 500)
    return { error: 'INTERNAL_SERVER_ERROR' }
  }
})
