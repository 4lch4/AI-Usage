export type RunCommand = (cmd: string[]) => Promise<{ exitCode: number; stdout: string }>

/**
 * Runs a command and captures its output. Exported so other modules can shell out with the same
 * spawn behaviour and stay testable by injecting a fake.
 */
export const runReg: RunCommand = async cmd => {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'ignore' })
  const stdout = await new Response(proc.stdout).text()
  return { exitCode: await proc.exited, stdout }
}

const runWithBun: RunCommand = runReg

/**
 * Pulls the value out of `reg query HKCU\Environment /v NAME` output, which looks like
 * `    NAME    REG_SZ    value`.
 */
export function parseRegQuery(stdout: string, name: string): string | undefined {
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(\S+)\s+REG_(?:EXPAND_)?SZ\s+(.*)$/)
    if (match && match[1]?.toLowerCase() === name.toLowerCase()) {
      return match[2]?.trim() || undefined
    }
  }
  return undefined
}

/**
 * Reads an environment variable, falling back on Windows to the saved user-level value.
 *
 * A tray app launched from Explorer or at login may not have inherited a variable that was
 * saved with `setx` after the session started, so the registry copy is the reliable source.
 */
export async function readEnv(
  name: string,
  deps: { env?: Record<string, string | undefined>; platform?: string; run?: RunCommand } = {},
): Promise<string | undefined> {
  const env = deps.env ?? process.env
  const direct = env[name]?.trim()
  if (direct) return direct
  if ((deps.platform ?? process.platform) !== 'win32') return undefined
  try {
    const { exitCode, stdout } = await (deps.run ?? runWithBun)([
      'reg',
      'query',
      'HKCU\\Environment',
      '/v',
      name,
    ])
    return exitCode === 0 ? parseRegQuery(stdout, name) : undefined
  } catch {
    return undefined
  }
}
