import { deflateSync } from 'node:zlib'
import { ICON_COLORS, ICON_SIZE, type IconSlot, iconLayout } from '../icon-layout.ts'

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

export type { IconSlot }

export function renderTrayIcon(slots: IconSlot[]): Uint8Array {
  return encodeIco(renderTrayPng(slots), ICON_SIZE)
}

/** The same meters as {@link renderTrayIcon}, as bare PNG bytes. */
export function renderTrayPng(slots: IconSlot[]): Uint8Array {
  const rgba = new Uint8Array(ICON_SIZE * ICON_SIZE * 4)
  for (const bar of iconLayout(slots)) {
    for (let y = bar.y; y < bar.y + bar.height; y++) {
      for (let x = bar.x; x < bar.x + bar.width; x++) {
        const paint = x - bar.x < bar.fillWidth ? bar.fill : 'track'
        rgba.set(ICON_COLORS[paint], (y * ICON_SIZE + x) * 4)
      }
    }
  }
  return encodePng(ICON_SIZE, ICON_SIZE, rgba)
}
