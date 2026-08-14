import { ZipArchive } from 'archiver'
import {
  contentDisposition,
  isUnlocked,
  recordDownload,
  resolveDownload
} from '../../../utils/download'
import { downloadLimiter, enforceRateLimit } from '../../../utils/rateLimit'
import { resolveStoredFile, storedFileExists } from '../../../utils/storage'
import { logger } from '../../../utils/logger'

// Download an entire transfer as one zip.
//
// The archive is streamed as it is built — nothing is staged on disk or held in
// memory first — so a 20 GB transfer costs the same working set as a 20 MB one
// and the recipient's download starts immediately. That rules out a
// `Content-Length` header, so the response is chunked and the browser shows an
// indeterminate progress bar. Worth it: the alternative is building the zip
// twice, or writing a temporary copy of every transfer anyone downloads.
export default defineEventHandler(async (event) => {
  if (!enforceRateLimit(event, downloadLimiter)) {
    return { error: 'TOO_MANY_REQUESTS' }
  }

  const resolution = await resolveDownload(getRouterParam(event, 'token'))
  if (!resolution.ok) {
    setResponseStatus(event, resolution.status)
    return { error: resolution.error }
  }

  const { transfer, files } = resolution

  if (!isUnlocked(event, transfer)) {
    setResponseStatus(event, 403)
    return { error: 'LOCKED' }
  }

  if (files.length === 0) {
    setResponseStatus(event, 404)
    return { error: 'NOT_FOUND' }
  }

  // Named after the transfer so a downloads folder full of these is still
  // navigable; falls back to the id when there's no subject.
  const baseName = (transfer.subject || `transfer-${transfer.id}`)
    .replace(/[/\\?%*:|"<>]/g, '-')
    .slice(0, 80)

  setResponseHeader(event, 'Content-Type', 'application/zip')
  setResponseHeader(event, 'Content-Disposition', contentDisposition(`${baseName}.zip`))
  setResponseHeader(event, 'Cache-Control', 'private, no-store')

  // Store-only: the payloads here are overwhelmingly already-compressed media and
  // archives, so deflate would burn CPU on every download for ~1% saved, and slow
  // the stream to the speed of the compressor.
  const archive = new ZipArchive({ store: true })

  archive.on('warning', (warning: Error) => {
    // ENOENT here means a file vanished between the listing and the read; the
    // rest of the archive is still worth sending.
    logger.warn('Zip archive warning', { transferId: transfer.id, warning })
  })

  archive.on('error', (error: Error) => {
    // Too late for a status code — headers are long gone and the client has
    // partial bytes. Destroying the stream makes the download fail visibly
    // rather than delivering a silently truncated zip.
    logger.error('Zip archive error', { transferId: transfer.id, error })
    archive.destroy()
  })

  // Duplicate names are real: two files picked from different folders. Zip allows
  // them, but the recipient's unzip tool will either overwrite or prompt, so they
  // get a numeric suffix here instead.
  const usedNames = new Set<string>()
  const uniqueName = (filename: string): string => {
    if (!usedNames.has(filename)) {
      usedNames.add(filename)
      return filename
    }

    const dot = filename.lastIndexOf('.')
    const stem = dot > 0 ? filename.slice(0, dot) : filename
    const ext = dot > 0 ? filename.slice(dot) : ''

    let counter = 2
    let candidate = `${stem} (${counter})${ext}`
    while (usedNames.has(candidate)) {
      counter++
      candidate = `${stem} (${counter})${ext}`
    }
    usedNames.add(candidate)
    return candidate
  }

  for (const file of files) {
    const path = resolveStoredFile(transfer.id, file.storedName, event)
    if (!path) continue

    // Checked before appending: archiver treats a missing source as a warning and
    // carries on, which would produce a zip quietly missing a file.
    if (!(await storedFileExists(transfer.id, file.storedName, event))) {
      logger.warn('Skipping missing file in zip', { transferId: transfer.id, fileId: file.id })
      continue
    }

    archive.file(path, { name: uniqueName(file.filename) })
  }

  await recordDownload(transfer.id)

  // Not awaited: finalize() resolves only once every byte has been written to the
  // response, and the stream has to be returned to h3 for that to happen at all.
  archive.finalize().catch((error: Error) => {
    logger.error('Zip finalize error', { transferId: transfer.id, error })
  })

  return sendStream(event, archive)
})
