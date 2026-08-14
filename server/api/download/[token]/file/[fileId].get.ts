import { createReadStream, promises as fs } from 'node:fs'
import {
  contentDisposition,
  isUnlocked,
  recordDownload,
  resolveDownload
} from '../../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../../utils/rateLimit'
import { resolveStoredFile } from '../../../../utils/storage'
import { toPositiveInt } from '../../../../utils/validation'
import { logger } from '../../../../utils/logger'

// Stream one file out of a transfer.
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

    // A protected transfer needs the unlock cookie here too — otherwise the
    // password would only guard the listing while the files stayed reachable to
    // anyone who guessed a file id.
    if (!isUnlocked(event, resolution.transfer)) {
      setResponseStatus(event, 403)
      return { error: 'LOCKED' }
    }

    const fileId = toPositiveInt(getRouterParam(event, 'fileId'))
    // Matched against this transfer's own files, so a valid token can't be used
    // to pull a file id belonging to someone else's transfer.
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

    // The row can outlive the file if a sweep was interrupted; treat that as gone
    // rather than letting the stream fail after headers are already sent.
    let stats
    try {
      stats = await fs.stat(path)
    } catch {
      logger.warn('Stored file missing for live transfer', {
        transferId: resolution.transfer.id,
        fileId: file.id
      })
      setResponseStatus(event, 404)
      return { error: 'NOT_FOUND' }
    }

    // Everything is served as an attachment with a neutral content type. Handing
    // back the uploader's declared type would let someone upload an .html file
    // and have it render in the recipient's browser, on this app's origin —
    // which is a stored XSS against the download page's own domain.
    setResponseHeader(event, 'Content-Type', 'application/octet-stream')
    setResponseHeader(event, 'Content-Length', stats.size)
    setResponseHeader(event, 'Content-Disposition', contentDisposition(file.filename))
    // A download URL is a secret; caching it in a shared proxy is not wanted.
    setResponseHeader(event, 'Cache-Control', 'private, no-store')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')

    await recordDownload(resolution.transfer.id)

    return sendStream(event, createReadStream(path))
  } catch (error) {
    logger.error('File download error', error)
    setResponseStatus(event, 500)
    return { error: 'DOWNLOAD_FAILED' }
  }
})
