import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ClaudeToken, createClaudeProvider } from '../providers/claude.ts'
import { type Provider, ProviderError } from '../types.ts'
import type { RunCommand } from './windows-env.ts'

export interface ClaudeDeps {
  fetch?: typeof fetch
  now?: () => Date
  /** Directory holding `.credentials.json`. Defaults to `$CLAUDE_CONFIG_DIR` or `~/.claude`. */
  configDir?: string
  readText?: (path: string) => Promise<string>
  /** Defaults to `process.platform`. The WSL fallback only runs on `win32`. */
  platform?: string
  /** Runs `wsl.exe` to read the WSL sign-in. */
  run?: RunCommand
}

/** Why a saved sign-in could not be used, worded for the user. */
type Unusable = { ok: false; message: string }
type Usable = { ok: true; token: ClaudeToken }

const LOGIN_HINT = 'Run "claude auth login" (or open "claude" and type /login) to sign in again.'

/**
 * Checks one `.credentials.json` body. `where` names its location in messages.
 *
 * When Claude Code cannot refresh its sign-in it rewrites the file with the account details kept
 * but both tokens emptied and `expiresAt` set to 0, so an empty token means "signed out", not a
 * different file layout.
 */
export function parseClaudeCredentials(text: string, where: string, now: Date): Usable | Unusable {
  let oauth: unknown
  try {
    oauth = (JSON.parse(text) as { claudeAiOauth?: unknown }).claudeAiOauth
  } catch {
    return { ok: false, message: `${where} is not valid JSON. ${LOGIN_HINT}` }
  }
  if (oauth === undefined || oauth === null) {
    return { ok: false, message: `${where} has no Claude sign-in. ${LOGIN_HINT}` }
  }
  const { accessToken, expiresAt } = oauth as { accessToken?: unknown; expiresAt?: unknown }
  if (typeof accessToken !== 'string' || !accessToken) {
    return {
      ok: false,
      message: `Claude Code is signed out (its sign-in could not be renewed). ${LOGIN_HINT}`,
    }
  }
  if (typeof expiresAt === 'number' && expiresAt <= now.getTime()) {
    return {
      ok: false,
      message: 'Claude Code’s sign-in has expired. Open "claude" once to refresh it.',
    }
  }
  return { ok: true, token: { accessToken } }
}

const runWsl: RunCommand = async cmd => {
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'ignore',
    windowsHide: true,
    timeout: 15_000,
  })
  const stdout = await new Response(proc.stdout).text()
  return { exitCode: await proc.exited, stdout }
}

/**
 * Reads Claude Code's sign-in from the default WSL distro, for people who run `claude` there.
 * Returns undefined when WSL is missing or has no readable file.
 */
export async function readWslCredentials(run: RunCommand = runWsl): Promise<string | undefined> {
  try {
    const { exitCode, stdout } = await run([
      'wsl.exe',
      '-e',
      'sh',
      '-c',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: shell expansion inside WSL, not JS
      'cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.credentials.json"',
    ])
    return exitCode === 0 && stdout.trim() ? stdout : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads the token Claude Code saved in `.credentials.json`, refusing one that has expired.
 *
 * On Windows, when that sign-in is missing, signed out or expired, it falls back to the sign-in
 * Claude Code saved inside WSL. It is the same account and the usage endpoint reports the same
 * limits, so either token works.
 */
export async function readClaudeCodeToken(deps: ClaudeDeps = {}): Promise<ClaudeToken> {
  const dir = deps.configDir ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
  const path = join(dir, '.credentials.json')
  const now = (deps.now ?? (() => new Date()))()

  let local: Usable | Unusable
  try {
    const text = await (deps.readText ?? ((p: string) => readFile(p, 'utf8')))(path)
    local = parseClaudeCredentials(text, path, now)
  } catch {
    local = { ok: false, message: `No Claude Code sign-in found at ${path}. ${LOGIN_HINT}` }
  }
  if (local.ok) return local.token

  if ((deps.platform ?? process.platform) === 'win32') {
    const text = await readWslCredentials(deps.run)
    if (text) {
      const wsl = parseClaudeCredentials(text, 'The WSL sign-in', now)
      if (wsl.ok) return wsl.token
    }
  }
  throw new ProviderError(local.message)
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
