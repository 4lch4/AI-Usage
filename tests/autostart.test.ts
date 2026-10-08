import { describe, expect, test } from 'bun:test'
import {
  applyAutostart,
  parseRunValue,
  RUN_KEY,
  RUN_VALUE,
  readAutostart,
  startupCommand,
} from '../src/core/autostart.ts'

const launcher = 'C:\\Program Files\\AI Usage\\launcher.exe'
const cmd = startupCommand(launcher)

/** A `run` double that records commands and replays canned stdout. */
function fakeRun(options: { stdout?: string; exitCode?: number } = {}) {
  const calls: string[][] = []
  const run = async (cmd: string[]) => {
    calls.push(cmd)
    return { exitCode: options.exitCode ?? 0, stdout: options.stdout ?? '' }
  }
  return { calls, run }
}

describe('startupCommand', () => {
  test('quotes the path so a space in it does not split the argument', () => {
    expect(cmd).toBe('"C:\\Program Files\\AI Usage\\launcher.exe"')
  })
})

describe('parseRunValue', () => {
  test('reads the stored command', () => {
    const stdout = `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\r\n    ${RUN_VALUE}    REG_SZ    ${cmd}\r\n\r\n`
    expect(parseRunValue(stdout, RUN_VALUE)).toBe(cmd)
  })

  test('returns nothing when the value is absent or empty', () => {
    expect(
      parseRunValue('ERROR: The system was unable to find the specified registry key', RUN_VALUE),
    ).toBeUndefined()
    expect(parseRunValue(`    ${RUN_VALUE}    REG_SZ    `, RUN_VALUE)).toBeUndefined()
  })
})

describe('readAutostart', () => {
  test('reports off when there is no Run value', async () => {
    const { run } = fakeRun({ stdout: 'ERROR: The system was unable to find the specified key' })
    expect(await readAutostart(launcher, { run, platform: 'win32' })).toEqual({
      enabled: false,
      stale: false,
    })
  })

  test('reports on when the stored command is ours', async () => {
    const { run } = fakeRun({ stdout: `    ${RUN_VALUE}    REG_SZ    ${cmd}` })
    expect(await readAutostart(launcher, { run, platform: 'win32' })).toEqual({
      enabled: true,
      command: cmd,
      stale: false,
    })
  })

  test('flags an entry pointing at a moved install as stale', async () => {
    const moved = startupCommand('C:\\Old\\launcher.exe')
    const { run } = fakeRun({ stdout: `    ${RUN_VALUE}    REG_SZ    ${moved}` })
    const state = await readAutostart(launcher, { run, platform: 'win32' })
    expect(state.enabled).toBe(true)
    expect(state.stale).toBe(true)
  })

  test('treats a non-zero exit as off rather than throwing', async () => {
    const { run } = fakeRun({ exitCode: 1 })
    expect(await readAutostart(launcher, { run, platform: 'win32' })).toEqual({
      enabled: false,
      stale: false,
    })
  })

  test('does nothing off Windows', async () => {
    const { calls, run } = fakeRun()
    expect(await readAutostart(launcher, { run, platform: 'darwin' })).toEqual({
      enabled: false,
      stale: false,
    })
    expect(calls).toEqual([])
  })
})

describe('applyAutostart', () => {
  test('writes a REG_SZ entry with /f so an existing value is replaced', async () => {
    const { calls, run } = fakeRun()
    await applyAutostart(true, launcher, { run, platform: 'win32' })
    expect(calls).toEqual([['add', RUN_KEY, '/v', RUN_VALUE, '/t', 'REG_SZ', '/d', cmd, '/f']])
  })

  test('deletes the value to turn autostart off', async () => {
    const { calls, run } = fakeRun()
    await applyAutostart(false, launcher, { run, platform: 'win32' })
    expect(calls).toEqual([['delete', RUN_KEY, '/v', RUN_VALUE, '/f']])
  })

  test('reports a failed write so the caller can tell the user', async () => {
    const { run } = fakeRun({ exitCode: 1 })
    await expect(applyAutostart(true, launcher, { run, platform: 'win32' })).rejects.toThrow(
      /reg exited/,
    )
  })

  test('does nothing off Windows', async () => {
    const { calls, run } = fakeRun()
    await applyAutostart(true, launcher, { run, platform: 'darwin' })
    expect(calls).toEqual([])
  })
})
