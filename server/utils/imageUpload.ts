import { createWriteStream, promises as fs } from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import Busboy from 'busboy'
import type { H3Event } from 'h3'
import { detectImageMime } from './images'
import { generateStoredName } from './storage'

// Receiving one image from a multipart request, for the two places a background
// can be set: on a single transfer, and as a member's default.
//
// Shared so the two cannot drift apart. Both are rendered inline by the browser,
// so both must refuse anything whose bytes are not a real image, and both must
// never leave a half-written or rejected file behind.

// Backgrounds are decoration and get sent to every visitor of a page, so this is
// capped far below the per-file limit.
export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024

export type ImageUploadError = 'INVALID_CONTENT_TYPE' | 'FILE_TOO_LARGE' | 'NOT_AN_IMAGE' | 'NO_FILE' | 'UPLOAD_ABORTED'

/**
 * Stream exactly one image from the request into `dir` under a fresh stored
 * name, and resolve with that name.
 *
 * Rejects with an `Error` whose message is an `ImageUploadError`. The image
 * check runs on the bytes once they are on disk, because the answer has to come
 * from the file rather than from anything the request claims about it.
 */
export async function receiveImageUpload(
  event: H3Event,
  dir: string,
  options: { prefix: string, maxBytes: number }
): Promise<string> {
  const contentType = getRequestHeader(event, 'content-type') || ''
  if (!contentType.includes('multipart/form-data')) throw new Error('INVALID_CONTENT_TYPE')

  await fs.mkdir(dir, { recursive: true })

  return await new Promise<string>((resolve, reject) => {
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: options.maxBytes, files: 1, fields: 1 }
    })

    // Prefixed so it is obvious on disk what the file is for.
    const name = `${options.prefix}${generateStoredName()}`
    const targetPath = join(dir, name)

    let settled = false
    let sawFile = false

    const failWith = (error: Error) => {
      if (settled) return
      settled = true
      fs.rm(targetPath, { force: true }).catch(() => {}).finally(() => reject(error))
    }

    busboy.on('file', (_field, stream) => {
      sawFile = true

      stream.on('limit', () => {
        stream.destroy()
        failWith(new Error('FILE_TOO_LARGE'))
      })

      pipeline(stream, createWriteStream(targetPath))
        .then(async () => {
          if (settled) return
          if ((stream as NodeJS.ReadableStream & { truncated?: boolean }).truncated) {
            failWith(new Error('FILE_TOO_LARGE'))
            return
          }

          if (!(await detectImageMime(targetPath))) {
            failWith(new Error('NOT_AN_IMAGE'))
            return
          }

          settled = true
          resolve(name)
        })
        .catch(failWith)
    })

    busboy.on('error', (error: unknown) =>
      failWith(error instanceof Error ? error : new Error(String(error))))
    busboy.on('close', () => {
      if (!settled && !sawFile) failWith(new Error('NO_FILE'))
    })

    event.node.req.on('aborted', () => failWith(new Error('UPLOAD_ABORTED')))
    event.node.req.pipe(busboy)
  })
}

/**
 * The response for a rejected upload, or null for a failure that isn't the
 * client's doing — which the caller logs and answers with a 500.
 */
export function imageUploadFailure(error: unknown): { status: number, code: string } | null {
  switch (error instanceof Error ? error.message : '') {
    case 'INVALID_CONTENT_TYPE': return { status: 400, code: 'INVALID_CONTENT_TYPE' }
    case 'FILE_TOO_LARGE': return { status: 413, code: 'BACKGROUND_TOO_LARGE' }
    case 'NOT_AN_IMAGE': return { status: 400, code: 'NOT_AN_IMAGE' }
    case 'NO_FILE': return { status: 400, code: 'NO_FILE' }
    default: return null
  }
}
