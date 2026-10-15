import type { ProviderUsage, UsageWindow } from './types.ts'

export type Level = 'ok' | 'warn' | 'critical'

export function levelFor(percent: number): Level {
  if (percent >= 90) return 'critical'
  if (percent >= 70) return 'warn'
  return 'ok'
}

/** "1h 46m", "4d 1h", "<1m". */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return '<1m'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatPercent(percent: number): string {
  return `${Number.isInteger(percent) ? percent : Math.round(percent * 10) / 10}%`
}

/** The most-used window, which is the one most likely to stop you first. */
export function worstPercent(usage: ProviderUsage | undefined): number | null {
  if (!usage || usage.windows.length === 0) return null
  return Math.max(...usage.windows.map(w => w.usedPercent))
}

function find(windows: UsageWindow[], label: string): UsageWindow | undefined {
  return windows.find(w => w.label === label)
}

// Windows truncates tray tooltips at 127 characters.
const TOOLTIP_LIMIT = 127

export function formatTooltip(results: ProviderUsage[]): string {
  const lines = results.map(result => {
    if (result.windows.length === 0) return `${result.name}: unavailable`
    const session = find(result.windows, '5-hour')
    const weekly = find(result.windows, 'Weekly')
    const parts = [
      session && `5h ${formatPercent(session.usedPercent)}`,
      weekly && `wk ${formatPercent(weekly.usedPercent)}`,
    ].filter(Boolean)
    return `${result.name} ${parts.join(' · ')}${result.stale ? ' (stale)' : ''}`
  })
  const text = lines.join('\n')
  return text.length <= TOOLTIP_LIMIT ? text : `${text.slice(0, TOOLTIP_LIMIT - 1)}…`
}
