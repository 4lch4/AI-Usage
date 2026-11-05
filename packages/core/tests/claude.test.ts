import { describe, expect, test } from 'bun:test'
import { createClaudeCodeProvider } from '../src/node/claude-code.ts'
import { parseClaudeUsage } from '../src/providers/claude.ts'
import { ProviderError } from '../src/types.ts'

const credentials = (expiresAt = 4102444800000) =>
  JSON.stringify({ claudeAiOauth: { accessToken: 'sk-ant-oat-test', expiresAt } })

const body = {
  five_hour: { utilization: 48, resets_at: '2026-10-07T23:50:00.000Z' },
  seven_day: { utilization: 40, resets_at: '2026-10-08T04:00:00+00:00' },
  seven_day_opus: null,
}

function provider(overrides: Parameters<typeof createClaudeCodeProvider>[0] = {}) {
  return createClaudeCodeProvider({
    configDir: '/fake',
    platform: 'linux',
    readText: async () => credentials(),
    now: () => new Date('2026-10-07T22:00:00Z'),
    fetch: (async () => Response.json(body)) as unknown as typeof fetch,
    ...overrides,
  })
}

describe('parseClaudeUsage', () => {
  test('maps known windows and skips null ones', () => {
    const windows = parseClaudeUsage(body)
    expect(windows.map(w => [w.label, w.usedPercent])).toEqual([
      ['5-hour', 48],
      ['Weekly', 40],
    ])
    expect(windows[0]?.resetsAt?.toISOString()).toBe('2026-10-07T23:50:00.000Z')
  })

  test('ignores a window with no utilization or an unparseable reset', () => {
    const windows = parseClaudeUsage({
      five_hour: { utilization: 5, resets_at: 'soon' },
      seven_day: {},
    })
    expect(windows).toHaveLength(1)
    expect(windows[0]?.resetsAt).toBeNull()
  })
})

describe('claude provider', () => {
  test('sends the OAuth token with the beta header', async () => {
    let seen: Request | undefined
    const windows = await provider({
      fetch: (async (url: string, init: RequestInit) => {
        seen = new Request(url, init)
        return Response.json(body)
      }) as unknown as typeof fetch,
    }).fetchWindows()
    expect(windows).toHaveLength(2)
    expect(seen?.url).toBe('https://api.anthropic.com/api/oauth/usage')
    expect(seen?.headers.get('authorization')).toBe('Bearer sk-ant-oat-test')
    expect(seen?.headers.get('anthropic-beta')).toBe('oauth-2025-04-20')
  })

  test('explains a missing sign-in', async () => {
    const missing = provider({
      readText: async () => {
        throw new Error('ENOENT')
      },
    })
    await expect(missing.fetchWindows()).rejects.toThrow(/No Claude Code sign-in/)
  })

  test('does not call the API with an expired token', async () => {
    let called = false
    const expired = provider({
      readText: async () => credentials(1),
      fetch: (async () => {
        called = true
        return Response.json(body)
      }) as unknown as typeof fetch,
    })
    await expect(expired.fetchWindows()).rejects.toThrow(/expired/)
    expect(called).toBe(false)
  })

  test.each([
    [401, /rejected the sign-in/],
    [429, /rate limiting/],
    [500, /HTTP 500/],
  ])('reports HTTP %d', async (status, message) => {
    const failing = provider({
      fetch: (async () => new Response('', { status })) as unknown as typeof fetch,
    })
    const error = await failing.fetchWindows().catch(e => e)
    expect(error).toBeInstanceOf(ProviderError)
    expect(error.message).toMatch(message)
  })
})

describe('Claude Code sign-in', () => {
  // What Claude Code leaves behind when it cannot renew its sign-in.
  const signedOut = JSON.stringify({
    claudeAiOauth: { accessToken: '', refreshToken: '', expiresAt: 0, subscriptionType: 'pro' },
  })
  const wslCredentials = JSON.stringify({
    claudeAiOauth: { accessToken: 'sk-ant-oat-wsl', expiresAt: 4102444800000 },
  })

  test('says Claude Code is signed out when the tokens were emptied', async () => {
    const error = await provider({ readText: async () => signedOut })
      .fetchWindows()
      .catch(e => e)
    expect(error).toBeInstanceOf(ProviderError)
    expect(error.message).toMatch(/signed out/)
    expect(error.message).toMatch(/claude auth login/)
  })

  test('falls back to the WSL sign-in on Windows', async () => {
    let seen: Request | undefined
    let ran: string[] = []
    await provider({
      platform: 'win32',
      readText: async () => signedOut,
      run: async cmd => {
        ran = cmd
        return { exitCode: 0, stdout: wslCredentials }
      },
      fetch: (async (url: string, init: RequestInit) => {
        seen = new Request(url, init)
        return Response.json(body)
      }) as unknown as typeof fetch,
    }).fetchWindows()
    expect(ran[0]).toBe('wsl.exe')
    expect(seen?.headers.get('authorization')).toBe('Bearer sk-ant-oat-wsl')
  })

  test('prefers the Windows sign-in and skips WSL when it works', async () => {
    let ranWsl = false
    await provider({
      platform: 'win32',
      run: async () => {
        ranWsl = true
        return { exitCode: 0, stdout: wslCredentials }
      },
    }).fetchWindows()
    expect(ranWsl).toBe(false)
  })

  test('keeps the Windows message when WSL has no usable sign-in', async () => {
    for (const run of [
      async () => ({ exitCode: 1, stdout: '' }),
      async () => ({ exitCode: 0, stdout: signedOut }),
      async () => {
        throw new Error('wsl.exe not found')
      },
    ]) {
      const error = await provider({ platform: 'win32', readText: async () => signedOut, run })
        .fetchWindows()
        .catch(e => e)
      expect(error.message).toMatch(/signed out/)
    }
  })

  test('does not try WSL off Windows', async () => {
    let ranWsl = false
    const error = await provider({
      readText: async () => signedOut,
      run: async () => {
        ranWsl = true
        return { exitCode: 0, stdout: wslCredentials }
      },
    })
      .fetchWindows()
      .catch(e => e)
    expect(error).toBeInstanceOf(ProviderError)
    expect(ranWsl).toBe(false)
  })
})
