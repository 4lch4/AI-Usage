import { type Level, levelFor } from './format.ts'

/** The tray icon is drawn on a 32 by 32 grid; the Android widget scales the same layout. */
export const ICON_SIZE = 32

/** What each part of a bar is painted with. `unknown` is a Provider with no data yet. */
export type IconPaint = Level | 'track' | 'unknown'

/** RGBA colours shared by every surface that draws the meters, so they look the same everywhere. */
export const ICON_COLORS: Record<IconPaint, readonly [number, number, number, number]> = {
  ok: [74, 222, 128, 255],
  warn: [250, 204, 21, 255],
  critical: [248, 113, 113, 255],
  track: [148, 163, 184, 110],
  unknown: [148, 163, 184, 200],
}

/** One row of the tray icon: a Provider's busiest Window, or `null` for no data yet. */
export interface IconSlot {
  /** Used percent of the busiest Window, or `null` when there is nothing to show. */
  value: number | null
  /** A Provider switched off in Settings draws nothing at all, not an empty bar. */
  visible: boolean
}

/** One bar to draw, in {@link ICON_SIZE} grid units. */
export interface IconBar {
  x: number
  y: number
  width: number
  height: number
  /** How much of `width`, from the left, is filled; the rest is track. */
  fillWidth: number
  fill: Exclude<IconPaint, 'track'>
}

const BAR_X = 3
const BAR_WIDTH = ICON_SIZE - BAR_X * 2
const BAR_HEIGHT = 10
const BAR_TOPS = [4, 18] as const

/**
 * Where the meters go: the first slot on top, every later one in the bottom row. A hidden slot
 * gives no bar. A known value always fills at least 2 units so a near-zero Window still shows.
 */
export function iconLayout(slots: IconSlot[]): IconBar[] {
  const bars: IconBar[] = []
  slots.forEach((slot, index) => {
    if (!slot.visible) return
    bars.push({
      x: BAR_X,
      y: BAR_TOPS[index === 0 ? 0 : 1],
      width: BAR_WIDTH,
      height: BAR_HEIGHT,
      fillWidth:
        slot.value === null
          ? 0
          : Math.max(2, Math.round((Math.min(100, slot.value) / 100) * BAR_WIDTH)),
      fill: slot.value === null ? 'unknown' : levelFor(slot.value),
    })
  })
  return bars
}

/** An {@link ICON_COLORS} entry as a CSS colour, for surfaces that style views instead of pixels. */
export function iconColorCss(paint: IconPaint): string {
  const [r, g, b, a] = ICON_COLORS[paint]
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
}

/**
 * The meters as an SVG drawing on the {@link ICON_SIZE} grid, for surfaces that render SVG rather
 * than pixels, such as the Android widget. Each bar is its track with the fill drawn over it.
 */
export function iconSvg(bars: IconBar[], size: number = ICON_SIZE): string {
  const rect = (bar: IconBar, width: number, paint: IconPaint) => {
    const [r, g, b, a] = ICON_COLORS[paint]
    const opacity = Math.round((a / 255) * 100) / 100
    return `<rect x="${bar.x}" y="${bar.y}" width="${width}" height="${bar.height}" rx="2" fill="rgb(${r},${g},${b})" fill-opacity="${opacity}"/>`
  }
  const shapes = bars.flatMap(bar => [
    rect(bar, bar.width, 'track'),
    ...(bar.fillWidth > 0 ? [rect(bar, bar.fillWidth, bar.fill)] : []),
  ])
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">${shapes.join('')}</svg>`
}
