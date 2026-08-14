import { createReadStream } from 'node:fs'
import { isUnlocked, resolveDownload } from '../../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../../utils/rateLimit'
import { detectImageMime, inlineImageHeaders } from '../../../../utils/images'
import { resolveStoredFile } from '../../../../utils/storage'
import { toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// Serve an image from a transfer *inline*, for the gallery layout's thumbnails.
//
// This is the one place a recipient's browser renders an uploaded file instead of
// saving it, so it is deliberately the strictest endpoint in the app:
//
//   * the file's leading bytes must match a known raster image signature — the
//     uploader's declared type and filename are ignored entirely;
//   * the Content-Type sent is the one derived from those bytes;
//   * `nosniff` stops the browser second-guessing it, and a sandbox CSP strips
//     scripting and same-origin privileges from the response regardless.
//
// Anything that isn't a real image 404s, so a `.png` containing HTML can never be
// rendered on this origin. Downloads of the same file still work normally through
// the file endpoint, as an attachment.
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

    if (!isUnlocked(event, resolution.transfer)) {
      setResponseStatus(event, 403)
      return { error: 'LOCKED' }
    }

    const fileId = toPositiveInt(getRouterParam(event, 'fileId'))
    const file = resolution.files.find(candidate => candidate.id === fileId)
    if (!file) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const path = resolveStoredFile(resolution.transfer.id, file.storedName, event)
    if (!path) {
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    const mime = await detectImageMime(path)
    if (!mime) {
      // Not an image by its own bytes. Never served inline.
      setResponseStatus(event, 404)
      return { error: 'NOT_AN_IMAGE' }
    }

    for (const [header, value] of Object.entries(inlineImageHeaders(mime))) {
      setResponseHeader(event, header, value)
    }

    // Previews deliberately don't count as downloads — opening a gallery would
    // otherwise inflate the counter by the number of images on the page.
    return sendStream(event, createReadStream(path))
  } catch (error) {
    logger.error('Preview error', error)
    setResponseStatus(event, 500)
    return { error: 'PREVIEW_FAILED' }
  }
})
