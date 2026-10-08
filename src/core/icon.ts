import { deflateSync } from 'node:zlib'
import { type Level, levelFor } from './format.ts'

const SIZE = 32
const COLORS: Record<Level | 'track' | 'unknown', [number, number, number, number]> = {
  ok: [74, 222, 128, 255],
  warn: [250, 204, 21, 255],
  critical: [248, 113, 113, 255],
  track: [148, 163, 184, 110],
  unknown: [148, 163, 184, 200],
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Encodes straight RGBA pixels as an 8-bit PNG. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1)
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    png.set(part, offset)
    offset += part.length
  }
  return png
}

/**
 * Wraps a PNG in a single-image ICO container.
 *
 * The Windows tray loads the icon with `LoadImageW(LR_LOADFROMFILE)`, which reads `.bmp`, `.ico`,
 * `.cur` and `.ani` but not `.png`. Handing it a PNG fails silently and Windows draws its generic
 * application icon instead. An ICO whose one entry holds PNG bytes is what Vista and later expect,
 * and still gives us the alpha channel a flat BMP could not.
 */
export function encodeIco(png: Uint8Array, size: number): Uint8Array {
  const HEADER = 22 // ICONDIR (6) + one ICONDIRENTRY (16)
  const ico = new Uint8Array(HEADER + png.length)
  const view = new DataView(ico.buffer)
  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type 1: icon
  view.setUint16(4, 1, true) // one image
  ico[6] = size >= 256 ? 0 : size // 0 means 256 in the on-disk format
  ico[7] = size >= 256 ? 0 : size
  ico[8] = 0 // palette size
  ico[9] = 0 // reserved
  view.setUint16(10, 1, true) // colour planes
  view.setUint16(12, 32, true) // bits per pixel
  view.setUint32(14, png.length, true)
  view.setUint32(18, HEADER, true)
  ico.set(png, HEADER)
  return ico
}

/**
 * Draws one meter bar per value, stacked: top is Claude, bottom is OpenCode Go.
 * `null` means no data yet and draws a dim, empty bar.
 */
export function renderTrayIcon(values: [number | null, number | null]): Uint8Array {
  return encodeIco(renderTrayPng(values), SIZE)
}

/** The same meters as {@link renderTrayIcon}, as bare PNG bytes. */
export function renderTrayPng(values: [number | null, number | null]): Uint8Array {
  const rgba = new Uint8Array(SIZE * SIZE * 4)
  const barX = 3
  const barWidth = SIZE - barX * 2
  const barHeight = 10
  const tops = [4, 18] as const

  values.forEach((value, index) => {
    const top = tops[index === 0 ? 0 : 1]
    const fillWidth =
      value === null ? 0 : Math.max(2, Math.round((Math.min(100, value) / 100) * barWidth))
    const fill = COLORS[value === null ? 'unknown' : levelFor(value)]
    for (let y = top; y < top + barHeight; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        rgba.set(x - barX < fillWidth ? fill : COLORS.track, (y * SIZE + x) * 4)
      }
    }
  })
  return encodePng(SIZE, SIZE, rgba)
}
