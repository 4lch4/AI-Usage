import { describe, expect, test } from 'bun:test'
import { type Alert, describeAlert, detectAlerts } from '../src/core/alert.ts'
import {
  DEFAULT_SETTINGS,
  isVisible,
  loadSettings,
  mergeSettings,
  parseSettings,
  saveSettings,
  serializeSettings,
  settingsPath,
} from '../src/core/settings.ts'
import type { ProviderUsage, UsageWindow } from '../src/core/types.ts'

const now = new Date('2026-10-07T22:00:00Z')

function win(id: string, label: string, usedPercent: number): UsageWindow {
  return { id, label, usedPercent, resetsAt: new Date('2026-10-07T23:46:00Z') }
}

function usage(over: Partial<ProviderUsage> = {}): ProviderUsage {
  return {
    id: 'claude',
    name: 'Claude',
    fetchedAt: now,
    windows: [win('five_hour', '5-hour', 48), win('seven_day', 'Weekly', 40)],
    ...over,
  }
}

describe('detectAlerts', () => {
  const atLimit = usage({
    windows: [win('five_hour', '5-hour', 92), win('seven_day', 'Weekly', 40)],
  })

  /** The single Alert `detectAlerts` produced, failing the test if there was not exactly one. */
  function onlyAlert(results: ProviderUsage[], already: Set<string> = new Set()): Alert {
    const { alerts } = detectAlerts(results, already, 90)
    expect(alerts).toHaveLength(1)
    const [alert] = alerts
    if (!alert) throw new Error('unreachable: length asserted above')
    return alert
  }

  test('announces a window once when it reaches the threshold', () => {
    const first = detectAlerts([atLimit], new Set(), 90)
    expect(first.alerts).toHaveLength(1)
    expect(first.alerts[0]).toMatchObject({
      providerId: 'claude',
      label: '5-hour',
      usedPercent: 92,
    })

    // Still above the threshold on the next refresh: no repeat.
    expect(detectAlerts([atLimit], first.alerted, 90).alerts).toEqual([])
  })

  test('announces again after the window drops back below the threshold', () => {
    const crossed = detectAlerts([atLimit], new Set(), 90)
    const safe = usage({ windows: [win('five_hour', '5-hour', 70)] })

    // Back under the threshold: nothing to announce, and the window is forgotten.
    const recovered = detectAlerts([safe], crossed.alerted, 90)
    expect(recovered.alerts).toEqual([])
    expect(recovered.alerted.size).toBe(0)

    const recrossed = detectAlerts([atLimit], recovered.alerted, 90)
    expect(recrossed.alerts).toHaveLength(1)
  })

  test('a window that stays above the threshold is remembered across refreshes', () => {
    const crossed = detectAlerts([atLimit], new Set(), 90)
    const still = detectAlerts([atLimit], crossed.alerted, 90)
    expect(still.alerts).toEqual([])
    expect(still.alerted.has('claude:five_hour')).toBe(true)
  })

  test('ignores windows below the threshold and providers that failed', () => {
    expect(detectAlerts([usage()], new Set(), 90).alerts).toEqual([])

    const stale = usage({
      stale: true,
      error: 'Sign in again.',
      windows: [win('five_hour', '5-hour', 97)],
    })
    expect(detectAlerts([stale], new Set(), 90).alerts).toEqual([])
  })

  test('keys windows per provider so the same id on another provider is separate', () => {
    const go = usage({
      id: 'opencode-go',
      name: 'OpenCode Go',
      windows: [win('five_hour', '5-hour', 95)],
    })
    const first = detectAlerts([atLimit, go], new Set(), 90)
    expect(first.alerts.map(a => a.providerId)).toEqual(['claude', 'opencode-go'])
    expect(first.alerted.size).toBe(2)
  })

  test('describeAlert names the provider, the window and the reset countdown', () => {
    const described = describeAlert(onlyAlert([atLimit]))
    expect(described.title).toBe('Claude is near its limit')
    expect(described.body).toContain('5-hour')
    expect(described.body).toContain('92% used')
    expect(described.body).toContain('resets in')
  })

  test('describeAlert omits the countdown when the reset time is unknown', () => {
    const noReset = usage({ windows: [{ ...win('five_hour', '5-hour', 95), resetsAt: null }] })
    expect(describeAlert(onlyAlert([noReset])).body).not.toContain('resets in')
  })
})

describe('settings', () => {
  test('defaults cover both providers', () => {
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(isVisible(DEFAULT_SETTINGS, 'claude')).toBe(true)
  })

  test('a missing or corrupt file falls back to the defaults', async () => {
    const deps = {
      configDir: 'C:/cfg',
      readText: async () => {
        throw new Error('ENOENT')
      },
    }
    expect(await loadSettings(deps)).toEqual(DEFAULT_SETTINGS)

    const corrupt = await loadSettings({ ...deps, readText: async () => '{ not json' })
    expect(corrupt).toEqual(DEFAULT_SETTINGS)
  })

  test('bad fields fall back individually instead of discarding the file', () => {
    const parsed = parseSettings({
      refreshSeconds: 'soon',
      visibleProviders: ['claude', 'nope', 'claude'],
      alertAtPercent: 250,
    })
    expect(parsed.refreshSeconds).toBe(DEFAULT_SETTINGS.refreshSeconds)
    expect(parsed.alertAtPercent).toBe(100) // clamped, not discarded
    expect(parsed.visibleProviders).toEqual(['claude']) // unknown ids dropped, deduped
  })

  test('refresh interval is clamped to a floor so the tray cannot be hammered', () => {
    expect(parseSettings({ refreshSeconds: 1 }).refreshSeconds).toBe(60)
    expect(parseSettings({ refreshSeconds: 10 }).refreshSeconds).toBe(60)
    expect(parseSettings({ refreshSeconds: 900 }).refreshSeconds).toBe(900)
  })

  test('round-trips through save and load', async () => {
    const written: Record<string, string> = {}
    const settings = mergeSettings(DEFAULT_SETTINGS, {
      refreshSeconds: 900,
      visibleProviders: ['opencode-go'],
      alertAtPercent: 80,
    })
    await saveSettings(settings, {
      configDir: 'C:/cfg',
      writeText: async (path, text) => {
        written[path] = text
      },
      makeDir: async () => {},
    })
    const text = written[settingsPath('C:/cfg')] ?? ''
    expect(text).toContain('"refreshSeconds": 900')

    const loaded = await loadSettings({ configDir: 'C:/cfg', readText: async () => text })
    expect(loaded).toEqual(settings)
  })

  test('every provider may be hidden, and the Panel still opens', () => {
    const none = mergeSettings(DEFAULT_SETTINGS, { visibleProviders: [] })
    expect(none.visibleProviders).toEqual([])
    expect(isVisible(none, 'claude')).toBe(false)
  })

  test('serialized settings end in a newline and survive a round trip', () => {
    const text = serializeSettings(DEFAULT_SETTINGS)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseSettings(JSON.parse(text))).toEqual(DEFAULT_SETTINGS)
  })
})
