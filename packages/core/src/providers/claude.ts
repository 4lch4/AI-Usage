import { type Provider, ProviderError, type UsageWindow } from '../types.ts'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'

const WINDOWS = [
  ['five_hour', '5-hour'],
  ['seven_day', 'Weekly'],
  ['seven_day_opus', 'Weekly (Opus)'],
  ['seven_day_sonnet', 'Weekly (Sonnet)'],
] as const

/** An OAuth access token for the usage endpoint. */
export interface ClaudeToken {
  accessToken: string
}

export interface ClaudeProviderDeps {
  /** Where a usable token comes from. It throws a {@link ProviderError} when there is none. */
  token: () => Promise<ClaudeToken>
  fetch?: typeof fetch
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function parseClaudeUsage(body: unknown): UsageWindow[] {
  const record = (body ?? {}) as Record<
    string,
    { utilization?: unknown; resets_at?: unknown } | null
  >
  const windows: UsageWindow[] = []
  for (const [key, label] of WINDOWS) {
    const entry = record[key]
    if (typeof entry?.utilization !== 'number') continue
    windows.push({
      id: key,
      label,
      usedPercent: entry.utilization,
      resetsAt: toDate(entry.resets_at),
    })
  }
  return windows
}

/**
 * Claude plan usage through the same OAuth endpoint Claude Code uses. Where the token comes from
 * is the caller's choice: see `node/claude-code.ts` for the one Claude Code saved.
 */
export function createClaudeProvider(deps: ClaudeProviderDeps): Provider {
  const doFetch = deps.fetch ?? fetch
  return {
    id: 'claude',
    name: 'Claude',
    async fetchWindows() {
      const { accessToken } = await deps.token()
      const response = await doFetch(USAGE_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'anthropic-beta': 'oauth-2025-04-20',
          Accept: 'application/json',
          'User-Agent': 'claude-cli/2.1.0 (external, cli)',
        },
      })
      if (response.status === 401) {
        throw new ProviderError('Claude rejected the sign-in. Open "claude" once to refresh it.')
      }
      if (response.status === 429) {
        throw new ProviderError('Claude is rate limiting usage checks. Trying again later.')
      }
      if (!response.ok)
        throw new ProviderError(`Claude usage request failed (HTTP ${response.status}).`)
      const windows = parseClaudeUsage(await response.json())
      if (windows.length === 0) throw new ProviderError('Claude returned no usage windows.')
      return windows
    },
  }
}
