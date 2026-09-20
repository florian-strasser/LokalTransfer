import { createReadStream } from 'node:fs'
import { fail, requireMember } from '../../utils/auth'
import { detectImageMime, inlineImageHeaders } from '../../utils/images'
import { resolveUserFile } from '../../utils/storage'
import { logger } from '../../utils/logger'

// The signed-in member's default background, for the account page, the composer
// and the compose page behind it.
//
// Served to its owner only. Recipients never load this: every transfer carries a
// copy of its own, which goes out through the download page's endpoint under
// that transfer's token and expiry.
export default defineEventHandler(async (event) => {
  const auth = await requireMember(event)
  if (!auth.ok) return fail(event, auth)

  try {
    const path = auth.user.backgroundName
      ? resolveUserFile(auth.user.id, auth.user.backgroundName, event)
      : null
    // A file that has gone missing is detected here as a failed sniff.
    const mime = path ? await detectImageMime(path).catch(() => null) : null
    if (!path || !mime) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    for (const [header, value] of Object.entries(inlineImageHeaders(mime))) {
      setResponseHeader(event, header, value)
    }

    return sendStream(event, createReadStream(path))
  } catch (error) {
    logger.error('Default background error', error)
    setResponseStatus(event, 500)
    return { error: 'BACKGROUND_FAILED' }
  }
})
