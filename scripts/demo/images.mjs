// Generates the placeholder photographs the demo gallery needs.
//
// Written as real PNG bytes rather than shipped as binary assets: the gallery's
// preview endpoint sniffs magic bytes and refuses anything that isn't genuinely
// a raster image, so a stand-in file would 404 and the very feature the
// screenshot is meant to show would be missing. SVG is deliberately excluded by
// that endpoint too, which rules out the easy answer.
//
// Encoded by hand because a real image library is a heavy dependency for six
// gradients used once.
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * A diagonal two-colour gradient with a soft vignette — enough to read as a
 * photograph at thumbnail size without pretending to be one.
 */
export function gradientPng(width, height, from, to) {
  // Each row is prefixed with a filter byte; 0 means "no filter", which keeps
  // the encoder trivial at the cost of a slightly larger file.
  const raw = Buffer.alloc(height * (width * 3 + 1))
  let offset = 0

  for (let y = 0; y < height; y++) {
    raw[offset++] = 0
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2
      // Distance from the centre, normalised, used to darken the corners.
      const dx = x / width - 0.5
      const dy = y / height - 0.5
      const vignette = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy) * 0.9) * 0.35

      raw[offset++] = Math.round((from[0] + (to[0] - from[0]) * t) * vignette)
      raw[offset++] = Math.round((from[1] + (to[1] - from[1]) * t) * vignette)
      raw[offset++] = Math.round((from[2] + (to[2] - from[2]) * t) * vignette)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  // Bytes 10–12 stay zero: deflate compression, adaptive filtering, no interlace.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// Run directly to write the demo's background image:
//
//   node scripts/demo/images.mjs <outfile>
//
// The background is the reason the download page puts its card on the left, so a
// demo without one shows the layout with nothing to justify it. Written into the
// built server's public directory rather than the repo's, so it never becomes a
// committed asset — that folder is recreated by every build.
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2]
  if (!target) {
    console.error('usage: node scripts/demo/images.mjs <outfile>')
    process.exit(1)
  }

  const { writeFileSync } = await import('node:fs')
  // Deep and desaturated: the card sits on top of it, and anything busier would
  // fight the interface rather than sit behind it.
  writeFileSync(target, gradientPng(2560, 1440, [38, 44, 62], [12, 14, 22]))
  console.log(`wrote ${target}`)
}

/** The set used by the seeded gallery transfer. */
export const DEMO_PHOTOS = [
  { filename: 'beach-wedding-001.png', from: [244, 164, 96], to: [178, 34, 52] },
  { filename: 'beach-wedding-002.png', from: [70, 130, 180], to: [25, 25, 112] },
  { filename: 'beach-wedding-003.png', from: [143, 188, 143], to: [34, 80, 62] },
  { filename: 'beach-wedding-004.png', from: [221, 160, 221], to: [102, 51, 153] },
  { filename: 'beach-wedding-005.png', from: [255, 200, 124], to: [204, 0, 48] },
  { filename: 'beach-wedding-006.png', from: [176, 196, 222], to: [47, 79, 79] }
]
