import { describe, expect, test } from 'bun:test'
import {
  createOpenCodeGoProvider,
  parseOpenCodeGoUsage,
} from '../src/core/providers/opencode-go.ts'
import { parseRegQuery, readEnv } from '../src/core/windows-env.ts'

const now = new Date('2026-10-07T22:00:00Z')

describe('parseOpenCodeGoUsage', () => {
  test('reads relative and absolute resets from the API shape', () => {
    const windows = parseOpenCodeGoUsage(
      {
        usage: {
          rolling: { percent: 6, resetInSec: 600 },
          weekly: { percent: 0.5, resetsAt: '2026-10-11T00:00:00Z' },
          monthly: { percent: 1 },
        },
      },
      now,
    )
    expect(windows.map(w => [w.label, w.usedPercent])).toEqual([
      ['5-hour', 6],
      ['Weekly', 0.5],
      ['Monthly', 1],
    ])
    expect(windows[0]?.resetsAt?.toISOString()).toBe('2026-10-07T22:10:00.000Z')
    expect(windows[1]?.resetsAt?.toISOString()).toBe('2026-10-11T00:00:00.000Z')
    expect(windows[2]?.resetsAt).toBeNull()
  })

  test('accepts the console shape with nested windows', () => {
    const windows = parseOpenCodeGoUsage(
      {
        usage: {
          rollingUsage: { usagePercent: 25, resetInSec: 60 },
          weeklyUsage: { window: { usagePercent: 75 } },
        },
      },
      now,
    )
    expect(windows.map(w => w.usedPercent)).toEqual([25, 75])
  })

  test('rejects a response with no usage block', () => {
    expect(() => parseOpenCodeGoUsage({}, now)).toThrow(/Is Go active/)
  })
})

describe('opencode go provider', () => {
  const ok = (async () =>
    Response.json({ usage: { rolling: { percent: 3, resetInSec: 5 } } })) as unknown as typeof fetch

  test('asks for an API key when there is none', async () => {
    const provider = createOpenCodeGoProvider({ apiKey: async () => undefined, fetch: ok })
    await expect(provider.fetchWindows()).rejects.toThrow(/OPENCODE_API_KEY/)
  })

  test('sends the key as a bearer token', async () => {
    let auth = ''
    const provider = createOpenCodeGoProvider({
      apiKey: async () => 'oc-key',
      now: () => now,
      fetch: (async (_url: string, init: RequestInit) => {
        auth = new Headers(init.headers).get('authorization') ?? ''
        return Response.json({ usage: { rolling: { percent: 3, resetInSec: 5 } } })
      }) as unknown as typeof fetch,
    })
    expect(await provider.fetchWindows()).toHaveLength(1)
    expect(auth).toBe('Bearer oc-key')
  })

  test('explains a rejected key', async () => {
    const provider = createOpenCodeGoProvider({
      apiKey: async () => 'bad',
      fetch: (async () => new Response('', { status: 401 })) as unknown as typeof fetch,
    })
    await expect(provider.fetchWindows()).rejects.toThrow(/rejected the API key/)
  })
})

describe('readEnv', () => {
  const reg =
    'HKEY_CURRENT_USER\\Environment\r\n    OPENCODE_API_KEY    REG_SZ    oc-from-registry\r\n\r\n'

  test('parses reg query output', () => {
    expect(parseRegQuery(reg, 'OPENCODE_API_KEY')).toBe('oc-from-registry')
    expect(parseRegQuery(reg, 'OTHER')).toBeUndefined()
  })

  test('prefers the process environment', async () => {
    expect(
      await readEnv('K', {
        env: { K: ' live ' },
        platform: 'win32',
        run: async () => ({ exitCode: 1, stdout: '' }),
      }),
    ).toBe('live')
  })

  test('falls back to the saved user variable on Windows only', async () => {
    const run = async () => ({ exitCode: 0, stdout: reg })
    expect(await readEnv('OPENCODE_API_KEY', { env: {}, platform: 'win32', run })).toBe(
      'oc-from-registry',
    )
    expect(await readEnv('OPENCODE_API_KEY', { env: {}, platform: 'linux', run })).toBeUndefined()
  })

  test('treats a failed lookup as unset', async () => {
    const run = async () => {
      throw new Error('no reg.exe')
    }
    expect(await readEnv('X', { env: {}, platform: 'win32', run })).toBeUndefined()
  })
})
