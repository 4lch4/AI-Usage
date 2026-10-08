import { runReg } from './windows-env.ts'

/**
 * Where Windows looks for per-user startup entries. Writing here needs no administrator rights and
 * shows up in Task Manager's Startup tab, so the user can turn autostart off without our app.
 */
export const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'

/** Value name shown in Task Manager. */
export const RUN_VALUE = 'AI Usage'

/**
 * The command Windows runs at login: the launcher executable, quoted because a path under
 * `C:\Program Files\` or a user folder with a space in it would otherwise split into two arguments.
 */
export function startupCommand(launcherPath: string): string {
  return `"${launcherPath}"`
}

/** `reg query` output for one value: `    NAME    REG_SZ    <command>`. */
export function parseRunValue(stdout: string, name: string): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(\S+(?: \S+)*?)\s+REG_(?:EXPAND_)?SZ\s+(.*)$/)
    if (match && match[1]?.trim().toLowerCase() === name.toLowerCase()) {
      return match[2]?.trim() || undefined
    }
  }
  return undefined
}

export interface AutostartState {
  enabled: boolean
  /** The command Windows has stored, which may not be ours if it was moved or hand-edited. */
  command?: string
  /** True when the stored command is ours but points somewhere else, so it is stale. */
  stale: boolean
}

/**
 * Reads the current autostart entry.
 *
 * A Run value that points at a different path counts as stale rather than enabled: the entry is
 * there but will launch something that is not this app, which is the same user-visible problem as
 * autostart silently not working.
 */
export async function readAutostart(
  launcherPath: string,
  deps: { run?: typeof runReg; platform?: string } = {},
): Promise<AutostartState> {
  if ((deps.platform ?? process.platform) !== 'win32') return { enabled: false, stale: false }
  try {
    const { exitCode, stdout } = await (deps.run ?? runReg)(['query', RUN_KEY, '/v', RUN_VALUE])
    const command = exitCode === 0 ? parseRunValue(stdout, RUN_VALUE) : undefined
    if (!command) return { enabled: false, stale: false }
    const stale = command !== startupCommand(launcherPath)
    return { enabled: true, command, stale }
  } catch {
    return { enabled: false, stale: false }
  }
}

/**
 * Adds or removes the Run entry. Never throws: a failed write leaves autostart off, which is the
 * safe direction, and the caller reports the failure.
 */
export async function applyAutostart(
  enabled: boolean,
  launcherPath: string,
  deps: { run?: typeof runReg; platform?: string } = {},
): Promise<void> {
  if ((deps.platform ?? process.platform) !== 'win32') return
  const run = deps.run ?? runReg
  const args = enabled
    ? ['add', RUN_KEY, '/v', RUN_VALUE, '/t', 'REG_SZ', '/d', startupCommand(launcherPath), '/f']
    : ['delete', RUN_KEY, '/v', RUN_VALUE, '/f']
  const { exitCode } = await run(args)
  if (exitCode !== 0) {
    throw new Error(
      `reg exited with ${exitCode} while ${enabled ? 'adding' : 'removing'} autostart`,
    )
  }
}
