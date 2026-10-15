import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ICON_COLORS, ICON_SIZE, iconLayout } from '@ai-usage/core/icon-layout'
import { encodePng } from '@ai-usage/core/node/icon'

/**
 * Draws the launcher icons from the same bars as the tray icon, so there are no hand-made image
 * assets to keep in step. Run with `bun run icons` after changing the layout or colours.
 */
const BACKGROUND = [15, 23, 42, 255] as const // #0F172A, also the adaptive icon background
const SLOTS = [
  { value: 76, visible: true },
  { value: 28, visible: true },
]

/** Paints the bars at `scale` pixels per grid unit, inset by `pad` pixels on every side. */
function draw(size: number, pad: number, background: readonly number[] | null): Uint8Array {
  const rgba = new Uint8Array(size * size * 4)
  if (background) for (let i = 0; i < size * size; i++) rgba.set(background, i * 4)
  const scale = (size - pad * 2) / ICON_SIZE
  for (const bar of iconLayout(SLOTS)) {
    const x0 = Math.round(pad + bar.x * scale)
    const y0 = Math.round(pad + bar.y * scale)
    const x1 = Math.round(pad + (bar.x + bar.width) * scale)
    const y1 = Math.round(pad + (bar.y + bar.height) * scale)
    const fillEnd = Math.round(pad + (bar.x + bar.fillWidth) * scale)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const [r, g, b, a] = ICON_COLORS[x < fillEnd ? bar.fill : 'track']
        if (!background) {
          rgba.set([r, g, b, a], (y * size + x) * 4)
          continue
        }
        // A launcher icon is opaque, so a translucent colour is blended over the background.
        const t = a / 255
        const mix = (c: number, i: number) => Math.round(c * t + (background[i] ?? 0) * (1 - t))
        rgba.set([mix(r, 0), mix(g, 1), mix(b, 2), 255], (y * size + x) * 4)
      }
    }
  }
  return encodePng(size, size, rgba)
}

const assets = join(import.meta.dir, '..', 'assets')
writeFileSync(join(assets, 'icon.png'), draw(1024, 160, BACKGROUND))
// Android masks adaptive icons to roughly the middle two thirds, so the bars sit well inside it.
writeFileSync(join(assets, 'adaptive-foreground.png'), draw(1024, 300, null))
