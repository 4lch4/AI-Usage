import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ClaudeToken, createClaudeProvider } from '../providers/claude.ts'
import { type Provider, ProviderError } from '../types.ts'

export interface ClaudeDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Directory holding `.credentials.json`. Defaults to `$CLAUDE_CONFIG_DIR` or `~/.claude`. */
  configDir?: string
  readText?: (path: string) => Promise<string>
}

/** Reads the token Claude Code saved in `.credentials.json`, refusing one that has expired. */
export async function readClaudeCodeToken(deps: ClaudeDeps = {}): Promise<ClaudeToken> {
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
  const { accessToken, expiresAt } = (oauth ?? {}) as { accessToken?: unknown; expiresAt?: unknown }
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new ProviderError(`${path} has no Claude sign-in token. Run "claude" and sign in again.`)
  }
  const now = deps.now ?? (() => new Date())
  if (typeof expiresAt === 'number' && expiresAt <= now().getTime()) {
    throw new ProviderError('Claude Code’s sign-in has expired. Open "claude" once to refresh it.')
  }
  return { accessToken }
}

/**
 * Claude usage authenticated with the token Claude Code already saved. It never refreshes that
 * token: doing so would rotate the refresh token out from under Claude Code, so an expired token
 * just asks the user to open it.
 */
export function createClaudeCodeProvider(deps: ClaudeDeps = {}): Provider {
  return createClaudeProvider({
    token: () => readClaudeCodeToken(deps),
    fetch: deps.fetch,
  })
}
