import { createReadStream } from 'node:fs'
import { resolveDownload } from '../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../utils/rateLimit'
import { detectImageMime, inlineImageHeaders } from '../../../utils/images'
import { resolveStoredFile } from '../../../utils/storage'
import { logger } from '../../../utils/logger'

// A transfer's own background image.
//
// Served without requiring the unlock cookie, unlike everything else: the
// background is decoration, and showing it behind the password prompt is the
// point — a branded page shouldn't only appear after unlocking. It reveals
// nothing about the files.
//
// Same byte-sniffing rules as the gallery preview, since this is also rendered
// inline by the browser.
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

    const { transfer } = resolution
    if (!transfer.backgroundName) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const path = resolveStoredFile(transfer.id, String(transfer.backgroundName), event)
    if (!path) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const mime = await detectImageMime(path)
    if (!mime) {
      setResponseStatus(event, 404)
      return { error: 'NOT_AN_IMAGE' }
    }

    for (const [header, value] of Object.entries(inlineImageHeaders(mime))) {
      setResponseHeader(event, header, value)
    }

    return sendStream(event, createReadStream(path))
  } catch (error) {
    logger.error('Background error', error)
    setResponseStatus(event, 500)
    return { error: 'BACKGROUND_FAILED' }
  }
})
