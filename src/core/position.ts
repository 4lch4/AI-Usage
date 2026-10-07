export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const GAP = 8

/**
 * Places a popup panel just above (or below, when there is no room above) the tray icon,
 * centered on it and kept on screen. Returns null when the icon bounds are unknown, so the
 * caller can center the panel instead.
 */
export function positionPanel(
  icon: Rect,
  size: { width: number; height: number },
  screen: { width: number; height: number },
): { x: number; y: number } | null {
  if (icon.width <= 0 || icon.height <= 0) return null
  const x = Math.round(icon.x + icon.width / 2 - size.width / 2)
  const above = icon.y - size.height - GAP
  const y = above >= 0 ? above : icon.y + icon.height + GAP
  return {
    x: Math.max(GAP, Math.min(x, screen.width - size.width - GAP)),
    y: Math.max(0, Math.min(y, screen.height - size.height)),
  }
}
