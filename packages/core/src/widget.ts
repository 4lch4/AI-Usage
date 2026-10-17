import { formatPercent, type Level, levelFor, worstPercent } from './format.ts'
import type { IconSlot } from './icon-layout.ts'
import type { ProviderUsage } from './types.ts'

/** What the home-screen widget shows for one Provider. */
export interface WidgetView {
  /** The two meter rows: the 5-hour Window on top, the busiest longer Window below. */
  slots: IconSlot[]
  /** The busiest Window's used percent, such as "42%", or a dash when there is nothing to show. */
  caption: string
  /** Colours the caption; `unknown` when there is no data. */
  level: Level | 'unknown'
}

/**
 * Lays one Provider out for a 1x1 widget, the same two rows the tray draws for two Providers: the
 * short Window that stops you first on top, and whichever longer Window is closer to its limit
 * below. `undefined` usage is a widget with no data yet.
 */
export function widgetView(usage: ProviderUsage | undefined): WidgetView {
  const windows = usage?.windows ?? []
  const short = windows.find(w => w.label === '5-hour')
  const longer = windows.filter(w => w !== short)
  const busiestLonger = longer.length > 0 ? Math.max(...longer.map(w => w.usedPercent)) : null
  const worst = worstPercent(usage)
  return {
    slots: [
      { value: short?.usedPercent ?? null, visible: true },
      { value: busiestLonger, visible: true },
    ],
    caption: worst === null ? '–' : formatPercent(Math.round(worst)),
    level: worst === null ? 'unknown' : levelFor(worst),
  }
}
