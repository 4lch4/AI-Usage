import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type Provider, ProviderError, type UsageWindow } from '../types.ts'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'

const WINDOWS = [
  ['five_hour', '5-hour'],
  ['seven_day', 'Weekly'],
  ['seven_day_opus', 'Weekly (Opus)'],
  ['seven_day_sonnet', 'Weekly (Sonnet)'],
] as const

export interface ClaudeDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Directory holding `.credentials.json`. Defaults to `$CLAUDE_CONFIG_DIR` or `~/.claude`. */
  configDir?: string
  readText?: (path: string) => Promise<string>
}

interface Credentials {
  accessToken: string
  expiresAt?: number
}

async function readCredentials(deps: ClaudeDeps): Promise<Credentials> {
  const dir = deps.configDir ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
  const path = join(dir, '.credentials.json')
  let text: string
  try {
    text = await (deps.readText ?? ((p: string) => readFile(p, 'utf8')))(path)
  } catch {
    throw new ProviderError(`No Claude Code sign-in found at ${path}. Run "claude" and sign in.`)
  }
  let oauth: unknown
  try {
    oauth = (JSON.parse(text) as { claudeAiOauth?: unknown }).claudeAiOauth
  } catch {
    throw new ProviderError(`${path} is not valid JSON. Run "claude" and sign in again.`)
  }
  const { accessToken, expiresAt } = (oauth ?? {}) as Partial<Credentials>
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new ProviderError(`${path} has no Claude sign-in token. Run "claude" and sign in again.`)
  }
  return { accessToken, expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined }
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
 * Claude plan usage through the same OAuth endpoint Claude Code uses, authenticated with the
 * token Claude Code already saved. It never refreshes that token: doing so would rotate the
 * refresh token out from under Claude Code, so an expired token just asks the user to open it.
 */
export function createClaudeProvider(deps: ClaudeDeps = {}): Provider {
  const doFetch = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  return {
    id: 'claude',
    name: 'Claude',
    async fetchWindows() {
      const { accessToken, expiresAt } = await readCredentials(deps)
      if (expiresAt && expiresAt <= now().getTime()) {
        throw new ProviderError(
          'Claude Code’s sign-in has expired. Open "claude" once to refresh it.',
        )
      }
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
