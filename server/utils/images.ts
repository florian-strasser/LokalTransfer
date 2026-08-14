import { promises as fs } from 'node:fs'

// Decide whether a stored file may be served *inline* to a browser.
//
// Everything a recipient downloads normally goes out as
// `application/octet-stream` with `Content-Disposition: attachment`, precisely so
// an uploaded file can never be rendered as active content on this origin. The
// gallery layout and the background image break that rule — they need real
// `<img src>` requests — so those two endpoints need a way to be certain a file
// really is an image.
//
// The browser's declared Content-Type is not that assurance: it is attacker
// controlled at upload time. Neither is the filename. So the file's own leading
// bytes are read and matched against known image signatures, and only a match is
// served inline, using the type derived from the bytes rather than anything the
// uploader supplied. An `.png` that is actually HTML fails to match and is never
// rendered.
//
// Sniffing happens at download rather than upload on purpose: it stays true even
// if a row in the database is later tampered with, and it keeps the streaming
// upload path simple.

/** Formats every current browser renders, and that can't carry active content. */
type Signature = {
  mime: string
  /** Byte values to match; null means "any byte" at that offset. */
  bytes: (number | null)[]
  offset: number
}

const SIGNATURES: Signature[] = [
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  // RIFF????WEBP — the four bytes in between are the file size.
  {
    mime: 'image/webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]
  },
  // ????ftypavif — an ISO-BMFF box, so the first four bytes are the box length.
  {
    mime: 'image/avif',
    offset: 0,
    bytes: [null, null, null, null, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]
  }
]

// SVG is deliberately absent. It is an image, but it is also a document that can
// carry scripts, so serving one inline would reintroduce exactly the
// cross-site-scripting hole this module exists to close. SVGs still download
// normally as attachments; they just never render in the gallery.

/** Longest signature, so only this many bytes need reading. */
const HEADER_BYTES = 16

/**
 * Identify a file by its leading bytes. Returns the image MIME type, or null if
 * it isn't one of the formats above — in which case it must not be served inline.
 */
export function sniffImageMime(header: Buffer): string | null {
  for (const signature of SIGNATURES) {
    const end = signature.offset + signature.bytes.length
    if (header.length < end) continue

    const matches = signature.bytes.every((byte, index) =>
      byte === null || header[signature.offset + index] === byte)

    if (matches) return signature.mime
  }

  return null
}

/** Read a file's header and identify it. Returns null for anything unreadable. */
export async function detectImageMime(path: string): Promise<string | null> {
  let handle
  try {
    handle = await fs.open(path, 'r')
    const buffer = Buffer.alloc(HEADER_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0)
    return sniffImageMime(buffer.subarray(0, bytesRead))
  } catch {
    return null
  } finally {
    await handle?.close()
  }
}

/**
 * Headers that make an inline response safe even if the sniff were somehow
 * wrong: the browser may not second-guess the type, and the sandbox CSP strips
 * scripting, plugins and same-origin privileges from whatever is served.
 */
export function inlineImageHeaders(mime: string): Record<string, string> {
  return {
    'Content-Type': mime,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox',
    // A download URL is a secret; keep it out of shared caches.
    'Cache-Control': 'private, max-age=3600'
  }
}
