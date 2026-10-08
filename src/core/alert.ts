import { formatDuration } from './format.ts'
import type { ProviderId, ProviderUsage } from './types.ts'

/** A Window that has just crossed the near-limit threshold. */
export interface Alert {
  providerId: ProviderId
  providerName: string
  label: string
  usedPercent: number
  resetsAt: Date | null
}

/** Windows already announced, so a Provider does not nag every Refresh. */
export type Alerted = ReadonlySet<string>

function key(providerId: ProviderId, windowId: string): string {
  return `${providerId}:${windowId}`
}

export interface AlertResult {
  alerts: Alert[]
  /** What to pass back next Refresh: still-near Windows plus the new ones. */
  alerted: Set<string>
}

/**
 * Finds Windows that have just reached `threshold`, once each.
 *
 * A Window is announced on the Refresh where it first reaches the threshold and not again until it
 * drops back below, so a Provider sitting at 95% stays quiet instead of repeating every five
 * minutes. Stale results are skipped: they are numbers from an earlier Refresh and would otherwise
 * re-announce a limit the user has already been told about.
 */
export function detectAlerts(
  results: readonly ProviderUsage[],
  already: Alerted,
  threshold: number,
): AlertResult {
  const alerts: Alert[] = []
  const alerted = new Set<string>()
  for (const result of results) {
    if (result.stale) continue
    for (const window of result.windows) {
      if (window.usedPercent < threshold) continue
      const id = key(result.id, window.id)
      alerted.add(id)
      if (already.has(id)) continue
      alerts.push({
        providerId: result.id,
        providerName: result.name,
        label: window.label,
        usedPercent: window.usedPercent,
        resetsAt: window.resetsAt,
      })
    }
  }
  return { alerts, alerted }
}

/** The title and body for one Alert, as a Windows notification shows them. */
export function describeAlert(alert: Alert): { title: string; body: string } {
  const percent = `${Math.round(alert.usedPercent * 10) / 10}% used`
  const reset = alert.resetsAt
    ? `, resets in ${formatDuration(alert.resetsAt.getTime() - Date.now())}`
    : ''
  return {
    title: `${alert.providerName} is near its limit`,
    body: `${alert.label} ${percent}${reset}`,
  }
}
