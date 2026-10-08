import { describe, expect, test } from 'bun:test'
import { inflateSync } from 'node:zlib'
import {
  formatDuration,
  formatPercent,
  formatTooltip,
  levelFor,
  worstPercent,
} from '../src/core/format.ts'
import { renderTrayIcon, renderTrayPng } from '../src/core/icon.ts'
import {
  choicesWithCurrent,
  PANEL_HEIGHT,
  parsePanelMessage,
  renderPanelHtml,
  scriptJson,
  toPanelPayload,
} from '../src/core/panel.ts'
import { positionInWorkArea, positionPanel } from '../src/core/position.ts'
import { refreshAll } from '../src/core/refresh.ts'
import { ALERT_CHOICES, DEFAULT_SETTINGS, REFRESH_CHOICES } from '../src/core/settings.ts'
import { type Provider, ProviderError, type ProviderUsage } from '../src/core/types.ts'

const now = new Date('2026-10-07T22:00:00Z')
const usage = (over: Partial<ProviderUsage> = {}): ProviderUsage => ({
  id: 'claude',
  name: 'Claude',
  fetchedAt: now,
  windows: [
    {
      id: 'five_hour',
      label: '5-hour',
      usedPercent: 48,
      resetsAt: new Date('2026-10-07T23:46:00Z'),
    },
    { id: 'seven_day', label: 'Weekly', usedPercent: 40.25, resetsAt: null },
  ],
  ...over,
})

describe('format', () => {
  test('formatDuration', () => {
    expect(formatDuration(30_000)).toBe('<1m')
    expect(formatDuration(46 * 60_000)).toBe('46m')
    expect(formatDuration(106 * 60_000)).toBe('1h 46m')
    expect(formatDuration((4 * 1440 + 61) * 60_000)).toBe('4d 1h')
    expect(formatDuration(-5)).toBe('<1m')
  })

  test('levels switch at 70 and 90', () => {
    expect([69, 70, 89, 90].map(levelFor)).toEqual(['ok', 'warn', 'warn', 'critical'])
  })

  test('formatPercent trims noise', () => {
    expect([48, 0.5, 40.25].map(formatPercent)).toEqual(['48%', '0.5%', '40.3%'])
  })

  test('worstPercent picks the busiest window', () => {
    expect(worstPercent(usage())).toBe(48)
    expect(worstPercent(usage({ windows: [] }))).toBeNull()
    expect(worstPercent(undefined)).toBeNull()
  })

  test('tooltip stays within the Windows limit and flags stale data', () => {
    const tip = formatTooltip([
      usage(),
      usage({ id: 'opencode-go', name: 'OpenCode Go', stale: true }),
    ])
    expect(tip).toBe('Claude 5h 48% \u00b7 wk 40.3%\nOpenCode Go 5h 48% \u00b7 wk 40.3% (stale)')
    expect(formatTooltip([usage({ name: 'x'.repeat(300) })]).length).toBe(127)
    expect(formatTooltip([usage({ windows: [] })])).toBe('Claude: unavailable')
  })
})

describe('refreshAll', () => {
  const ok: Provider = { id: 'claude', name: 'Claude', fetchWindows: async () => usage().windows }
  const failing = (error: unknown): Provider => ({
    id: 'claude',
    name: 'Claude',
    fetchWindows: async () => {
      throw error
    },
  })

  test('returns fresh windows on success', async () => {
    const [result] = await refreshAll([ok], new Map(), now)
    expect(result?.windows).toHaveLength(2)
    expect(result?.error).toBeUndefined()
  })

  test('keeps the last good numbers, marked stale, when a refresh fails', async () => {
    const before = usage({ fetchedAt: new Date('2026-10-07T21:00:00Z') })
    const [result] = await refreshAll(
      [failing(new ProviderError('Sign in again.'))],
      new Map([['claude', before]]),
      now,
    )
    expect(result).toMatchObject({ error: 'Sign in again.', stale: true })
    expect(result?.windows).toEqual(before.windows)
    expect(result?.fetchedAt).toEqual(before.fetchedAt)
  })

  test('has nothing to show on a first failure, and wraps unexpected errors', async () => {
    const [result] = await refreshAll([failing(new TypeError('fetch failed'))], new Map(), now)
    expect(result?.windows).toEqual([])
    expect(result?.stale).toBe(false)
    expect(result?.error).toBe('Could not reach the service (fetch failed).')
  })

  test('one provider failing does not affect the other', async () => {
    const other: Provider = {
      id: 'opencode-go',
      name: 'OpenCode Go',
      fetchWindows: async () => usage().windows,
    }
    const results = await refreshAll([failing(new ProviderError('x')), other], new Map(), now)
    expect(results.map(r => !!r.error)).toEqual([true, false])
  })
})

describe('renderTrayIcon', () => {
  function decode(png: Uint8Array) {
    const view = new DataView(png.buffer, png.byteOffset)
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    const idatLength = view.getUint32(33)
    const raw = inflateSync(png.subarray(41, 41 + idatLength))
    const pixel = (x: number, y: number) =>
      Array.from(raw.subarray(y * (1 + width * 4) + 1 + x * 4).subarray(0, 4))
    return { width, height, pixel }
  }

  const slots = (...values: (number | null)[]) => values.map(value => ({ value, visible: true }))

  test('produces a valid 32x32 PNG with proportional, color-coded fills', () => {
    const { width, height, pixel } = decode(renderTrayPng(slots(100, 10)))
    expect([width, height]).toEqual([32, 32])
    expect(pixel(25, 8)).toEqual([248, 113, 113, 255]) // full critical bar on top
    expect(pixel(25, 22)).toEqual([148, 163, 184, 110]) // 10% bar: track on the right
    expect(pixel(4, 22)).toEqual([74, 222, 128, 255]) // ...fill on the left
    expect(pixel(0, 0)).toEqual([0, 0, 0, 0])
  })

  test('draws an empty bar when there is no data', () => {
    const { pixel } = decode(renderTrayPng(slots(null, null)))
    expect(pixel(4, 8)).toEqual([148, 163, 184, 110])
  })

  test('draws nothing at all for a provider switched off in Settings', () => {
    const hidden = renderTrayPng([
      { value: 100, visible: true },
      { value: 10, visible: false },
    ])
    const { pixel } = decode(hidden)
    expect(pixel(25, 8)).toEqual([248, 113, 113, 255]) // the visible row is drawn
    expect(pixel(25, 22)).toEqual([0, 0, 0, 0]) // ...and the hidden one is not even a track
  })

  test('wraps the PNG in an ICO, which is what LoadImageW can read', () => {
    const ico = renderTrayIcon(slots(100, 10))
    const view = new DataView(ico.buffer, ico.byteOffset)
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 1,
    ])
    expect([ico[6], ico[7]]).toEqual([32, 32]) // width, height
    expect(view.getUint32(14, true)).toBe(ico.length - 22) // payload size
    expect(view.getUint32(18, true)).toBe(22) // payload offset
    // The payload is the PNG itself, signature and all.
    const png = ico.subarray(22)
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(decode(png).pixel(25, 8)).toEqual([248, 113, 113, 255])
  })
})

describe('parsePanelMessage', () => {
  const settingsMessage = { type: 'settings', patch: { refreshSeconds: 900 } } as const

  test('reads a message Electrobun already decoded for us', () => {
    // This is the shape that actually arrives: the page stringifies, then Electrobun parses again.
    expect(parsePanelMessage(settingsMessage)).toEqual(settingsMessage)
  })

  test('also reads the raw string, in case that ever changes', () => {
    expect(parsePanelMessage(JSON.stringify(settingsMessage))).toEqual(settingsMessage)
  })

  test('reads an autostart toggle', () => {
    expect(parsePanelMessage({ type: 'autostart', enabled: true })).toEqual({
      type: 'autostart',
      enabled: true,
    })
    // Anything other than a literal true is off; the checkbox must not read as on by accident.
    expect(parsePanelMessage({ type: 'autostart', enabled: 'yes' })).toEqual({
      type: 'autostart',
      enabled: false,
    })
  })

  test('reads a provider toggle', () => {
    expect(parsePanelMessage({ type: 'providerVisibility', id: 'claude', visible: false })).toEqual(
      {
        type: 'providerVisibility',
        id: 'claude',
        visible: false,
      },
    )
  })

  test('rejects anything it cannot trust', () => {
    expect(parsePanelMessage('{ not json')).toBeNull()
    expect(parsePanelMessage(null)).toBeNull()
    expect(parsePanelMessage(42)).toBeNull()
    expect(parsePanelMessage({ type: 'quit' })).toBeNull()
    expect(parsePanelMessage({ type: 'settings' })).toBeNull()
    expect(parsePanelMessage({ type: 'providerVisibility', id: 'nope', visible: true })).toBeNull()
  })
})

describe('choicesWithCurrent', () => {
  test('offers the built-in choices in order', () => {
    expect(choicesWithCurrent(ALERT_CHOICES, 90)).toEqual([...ALERT_CHOICES])
  })

  test('adds a hand-edited value so the dropdown shows what is really set', () => {
    expect(choicesWithCurrent(ALERT_CHOICES, 20)).toEqual([20, 70, 80, 90, 95])
  })

  test('does not duplicate a value that is already offered', () => {
    expect(choicesWithCurrent(REFRESH_CHOICES, 300)).toEqual([...REFRESH_CHOICES])
  })
})

describe('panel', () => {
  const allProviders = [
    { id: 'claude' as const, name: 'Claude' },
    { id: 'opencode-go' as const, name: 'OpenCode Go' },
  ]
  const panelOptions = { settings: DEFAULT_SETTINGS, allProviders }

  test('payload carries levels and ISO dates', () => {
    const [claude] = toPanelPayload([usage()], now, panelOptions).providers
    expect(claude?.windows[0]).toMatchObject({ level: 'ok', resetsAt: '2026-10-07T23:46:00.000Z' })
    expect(claude?.windows[1]?.resetsAt).toBeNull()
  })

  test('payload offers every provider, marking the hidden ones', () => {
    const settings = { ...DEFAULT_SETTINGS, visibleProviders: ['opencode-go' as const] }
    const payload = toPanelPayload(
      [usage(), usage({ id: 'opencode-go', name: 'OpenCode Go' })],
      now,
      { settings, allProviders },
    )
    expect(payload.allProviders).toEqual([
      { id: 'claude', name: 'Claude', visible: false },
      { id: 'opencode-go', name: 'OpenCode Go', visible: true },
    ])
    expect(payload.providers.map(p => p.id)).toEqual(['opencode-go'])
  })

  test('payload carries the choices so the Panel does not hard-code them', () => {
    const payload = toPanelPayload([usage()], now, panelOptions)
    expect(payload.choices.refreshSeconds).toEqual([...REFRESH_CHOICES])
    expect(payload.choices.alertAtPercent).toEqual([...ALERT_CHOICES])
    expect(payload.settings).toEqual({
      refreshSeconds: DEFAULT_SETTINGS.refreshSeconds,
      alertAtPercent: DEFAULT_SETTINGS.alertAtPercent,
      autostart: DEFAULT_SETTINGS.autostart,
    })
    expect(payload.autostartAvailable).toBe(false)
  })

  test('reports autostart as available only when the caller says so', () => {
    const payload = toPanelPayload([usage()], now, { ...panelOptions, autostartAvailable: true })
    expect(payload.autostartAvailable).toBe(true)
  })

  test('a hand-edited threshold is offered so the dropdown does not lie', () => {
    const settings = { ...DEFAULT_SETTINGS, alertAtPercent: 20 }
    const payload = toPanelPayload([usage()], now, { settings, allProviders })
    expect(payload.choices.alertAtPercent).toContain(20)
  })

  test('HTML embeds the payload without allowing script injection', () => {
    const payload = toPanelPayload(
      [usage({ error: '</script><script>alert(1)</script>' })],
      now,
      panelOptions,
    )
    const html = renderPanelHtml(payload)
    expect(html).not.toContain('</script><script>alert')
    expect(scriptJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}')
    expect(html).toContain('window.render = render')
  })

  test('HTML sends setting changes to the host and can be told to open Settings', () => {
    const html = renderPanelHtml(toPanelPayload([usage()], now, panelOptions))
    expect(html).toContain('__electrobunSendToHost')
    expect(html).toContain("type: 'providerVisibility'")
    expect(html).toContain('window.openSettings')
    // The Settings section starts hidden unless the user came from the tray's Settings item.
    expect(html).toContain('id="gear"')
  })

  test('the Panel scrolls inside a fixed window, so long content is never clipped', () => {
    const html = renderPanelHtml(toPanelPayload([usage()], now, panelOptions))
    expect(html).toContain('overflow-y:auto')
    expect(PANEL_HEIGHT).toBeGreaterThan(300)
  })
})

describe('positionPanel', () => {
  const size = { width: 320, height: 300 }
  const screen = { width: 1920, height: 1080 }

  test('centers above a bottom-taskbar icon', () => {
    expect(positionPanel({ x: 1700, y: 1040, width: 24, height: 40 }, size, screen)).toEqual({
      x: 1552,
      y: 732,
    })
  })

  test('stays on screen at the right edge', () => {
    expect(positionPanel({ x: 1900, y: 1040, width: 20, height: 40 }, size, screen)?.x).toBe(1592)
  })

  test('drops below an icon at the top of the screen', () => {
    expect(positionPanel({ x: 500, y: 0, width: 24, height: 30 }, size, screen)?.y).toBe(38)
  })

  test('returns null for unknown bounds', () => {
    expect(positionPanel({ x: 0, y: 0, width: 0, height: 0 }, size, screen)).toBeNull()
  })

  // The fallback for platforms where the tray reports no bounds.
  const workArea = { x: 0, y: 0, width: 1920, height: 1040 }

  test('parks the panel at the bottom-right of the work area', () => {
    expect(positionInWorkArea(size, workArea)).toEqual({ x: 1592, y: 732 })
  })

  test('offsets the panel when the taskbar is on the left of a second monitor', () => {
    expect(positionInWorkArea(size, { x: 1920, y: 0, width: 2560, height: 1400 })).toEqual({
      x: 4152,
      y: 1092,
    })
  })

  test('returns null for an unknown work area', () => {
    expect(positionInWorkArea(size, { x: 0, y: 0, width: 0, height: 0 })).toBeNull()
  })
})
