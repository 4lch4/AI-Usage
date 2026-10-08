import { type Provider, ProviderError, type UsageWindow } from '../types.ts'
import { readEnv } from '../windows-env.ts'

const USAGE_URL = 'https://opencode.ai/zen/go/v1/usage'

const WINDOWS = [
  ['5-hour', ['rolling', 'rollingUsage']],
  ['Weekly', ['weekly', 'weeklyUsage']],
  ['Monthly', ['monthly', 'monthlyUsage']],
] as const

const PERCENT_KEYS = ['percent', 'usagePercent', 'usedPercent', 'percentUsed']
const RESET_IN_KEYS = ['resetInSec', 'resetInSeconds']
const RESET_AT_KEYS = ['resetsAt', 'resetAt', 'resets_at', 'reset_at']

type Dict = Record<string, unknown>

function firstOf(dict: Dict | undefined, keys: readonly string[]): unknown {
  if (!dict) return undefined
  for (const key of keys) {
    if (dict[key] !== undefined && dict[key] !== null) return dict[key]
  }
  return undefined
}

export function parseOpenCodeGoUsage(body: unknown, now: Date): UsageWindow[] {
  const usage = (body as { usage?: Dict } | null)?.usage
  if (!usage)
    throw new ProviderError('OpenCode Go returned no usage. Is Go active on this account?')
  const windows: UsageWindow[] = []
  for (const [label, keys] of WINDOWS) {
    let window = firstOf(usage, keys) as Dict | undefined
    if (window && typeof window.window === 'object') window = window.window as Dict
    const percent = firstOf(window, PERCENT_KEYS)
    if (typeof percent !== 'number') continue
    const resetIn = firstOf(window, RESET_IN_KEYS)
    const resetAt = firstOf(window, RESET_AT_KEYS)
    let resetsAt: Date | null = null
    if (typeof resetIn === 'number') {
      resetsAt = new Date(now.getTime() + resetIn * 1000)
    } else if (typeof resetAt === 'string' || typeof resetAt === 'number') {
      const date = new Date(resetAt)
      resetsAt = Number.isNaN(date.getTime()) ? null : date
    }
    windows.push({ id: label.toLowerCase(), label, usedPercent: percent, resetsAt })
  }
  return windows
}

export interface OpenCodeGoDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Resolves the API key. Defaults to `OPENCODE_API_KEY` from the environment or the saved user variable. */
  apiKey?: () => Promise<string | undefined>
}

/** OpenCode Go plan usage, authenticated with an API key from opencode.ai (workspace > API Keys). */
export function createOpenCodeGoProvider(deps: OpenCodeGoDeps = {}): Provider {
  const doFetch = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  const resolveKey = deps.apiKey ?? (() => readEnv('OPENCODE_API_KEY'))
  return {
    id: 'opencode-go',
    name: 'OpenCode Go',
    async fetchWindows() {
      const key = await resolveKey()
      if (!key) {
        throw new ProviderError(
          'No OpenCode API key. Create one at opencode.ai (workspace > API Keys) and save it as OPENCODE_API_KEY.',
        )
      }
      const response = await doFetch(USAGE_URL, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          'User-Agent': 'AI-Usage',
        },
      })
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError('OpenCode rejected the API key. Create a new one at opencode.ai.')
      }
      if (!response.ok)
        throw new ProviderError(`OpenCode Go usage request failed (HTTP ${response.status}).`)
      const windows = parseOpenCodeGoUsage(await response.json(), now())
      if (windows.length === 0) throw new ProviderError('OpenCode Go returned no usage windows.')
      return windows
    },
  }
}
