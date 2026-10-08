export type ProviderId = 'claude' | 'opencode-go'

/** One rate-limit window, such as Claude's 5-hour session. `usedPercent` is 0 to 100. */
export interface UsageWindow {
  id: string
  label: string
  usedPercent: number
  resetsAt: Date | null
}

/** What the tray shows for one provider after a refresh. */
export interface ProviderUsage {
  id: ProviderId
  name: string
  windows: UsageWindow[]
  fetchedAt: Date
  /** Why the latest refresh failed. Windows from an earlier success may still be present. */
  error?: string
  /** True when `windows` came from an earlier refresh because the latest one failed. */
  stale?: boolean
}

export interface Provider {
  id: ProviderId
  name: string
  fetchWindows(): Promise<UsageWindow[]>
}

/** An expected failure with a message that is safe to show the user as-is. */
export class ProviderError extends Error {
  override name = 'ProviderError'
}
