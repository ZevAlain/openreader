// Generates the PWA PNG icons from code (no image tooling dependency).
// Usage: node scripts/generate-pwa-icons.mjs
// Writes frontend/public/icons/icon-{180,192,512}.png and icon-512-maskable.png.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(repo, 'frontend', 'public', 'icons')

// Brand palette (matches the app theme: deep teal on parchment).
const TEAL_TOP = [47, 111, 109]
const TEAL_BOTTOM = [31, 84, 82]
const PAPER = [246, 241, 229]

function clamp01(value) { return value < 0 ? 0 : value > 1 ? 1 : value }
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

// An open book drawn with signed-distance fields so every icon size stays crisp.
// Coordinates are normalized: x,y in [-1, 1], y grows downward.
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

function bookCoverage(x, y) {
  // Two mirrored pages meeting at a thin spine around x = 0.
  const page = sign => sdRoundBox(x, y, sign * 0.375, 0.03, 0.34, 0.36, 0.09)
  const sdf = Math.min(page(1), page(-1))
  const aa = 0.012
  return smoothstep(aa, -aa, sdf)
}

function renderIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  // Maskable icons bleed to the edges; regular ones keep a rounded-rect canvas.
  const cornerRadius = maskable ? 0 : size * 0.22
  const contentScale = maskable ? 1.25 : 1.0 // keep the glyph inside the 80% safe zone
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = ((px + 0.5) / size) * 2 - 1
      const y = ((py + 0.5) / size) * 2 - 1

      // Vertical teal gradient background.
      const mix = clamp01((y + 1) / 2)
      let r = TEAL_TOP[0] + (TEAL_BOTTOM[0] - TEAL_TOP[0]) * mix
      let g = TEAL_TOP[1] + (TEAL_BOTTOM[1] - TEAL_TOP[1]) * mix
      let b = TEAL_TOP[2] + (TEAL_BOTTOM[2] - TEAL_TOP[2]) * mix
      let alpha = 255

      if (!maskable) {
        // Rounded-corner mask with 1.5px antialiasing.
        const aa = 1.5 / size * 2
        const cx = Math.max(Math.abs(x) - (1 - cornerRadius / (size / 2)), 0)
        const cy = Math.max(Math.abs(y) - (1 - cornerRadius / (size / 2)), 0)
        const outside = Math.hypot(cx, cy) - cornerRadius / (size / 2)
        const cover = smoothstep(aa, -aa, outside)
        alpha = Math.round(255 * cover)
      }

      const book = bookCoverage(x * contentScale, y * contentScale)
      if (book > 0) {
        r = PAPER[0] * book + r * (1 - book)
        g = PAPER[1] * book + g * (1 - book)
        b = PAPER[2] * book + b * (1 - book)
      }

      const offset = (py * size + px) * 4
      pixels[offset] = Math.round(r)
      pixels[offset + 1] = Math.round(g)
      pixels[offset + 2] = Math.round(b)
      pixels[offset + 3] = alpha
    }
  }
  return pixels
}

function crc32(buffer) {
  let c = ~0
  for (let i = 0; i < buffer.length; i += 1) {
    c ^= buffer[i]
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
  }
  return ~c >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outDir, { recursive: true })
const outputs = [
  ['icon-180.png', renderIcon(180)],
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  ['icon-512-maskable.png', renderIcon(512, { maskable: true })],
]
for (const [name, pixels] of outputs) {
  const size = Math.round(Math.sqrt(pixels.length / 4))
  writeFileSync(join(outDir, name), encodePNG(size, pixels))
  console.log(`wrote frontend/public/icons/${name} (${size}x${size})`)
}
