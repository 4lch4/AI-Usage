import { describe, expect, test } from 'bun:test'
import { iconLayout, iconSvg } from '../src/icon-layout.ts'
import type { ProviderUsage } from '../src/types.ts'
import { widgetView } from '../src/widget.ts'

function usage(windows: [string, number][]): ProviderUsage {
  return {
    id: 'opencode-go',
    name: 'OpenCode Go',
    fetchedAt: new Date(0),
    windows: windows.map(([label, usedPercent]) => ({
      id: label.toLowerCase(),
      label,
      usedPercent,
      resetsAt: null,
    })),
  }
}

describe('widgetView', () => {
  test('puts the 5-hour Window on top and the busiest longer Window below', () => {
    const view = widgetView(
      usage([
        ['5-hour', 12],
        ['Weekly', 40],
        ['Monthly', 75.4],
      ]),
    )
    expect(view.slots).toEqual([
      { value: 12, visible: true },
      { value: 75.4, visible: true },
    ])
    expect(view.caption).toBe('75%')
    expect(view.level).toBe('warn')
  })

  test('shows empty rows and a dash with no data', () => {
    for (const view of [widgetView(undefined), widgetView(usage([]))]) {
      expect(view.slots).toEqual([
        { value: null, visible: true },
        { value: null, visible: true },
      ])
      expect(view.caption).toBe('–')
      expect(view.level).toBe('unknown')
    }
  })

  test('copes with a Provider that has no 5-hour Window', () => {
    const view = widgetView(usage([['Weekly', 95]]))
    expect(view.slots[0]?.value).toBeNull()
    expect(view.slots[1]?.value).toBe(95)
    expect(view.level).toBe('critical')
  })
})

describe('iconSvg', () => {
  test('draws a track and a fill per bar on the icon grid', () => {
    const svg = iconSvg(
      iconLayout([
        { value: 50, visible: true },
        { value: null, visible: true },
      ]),
      64,
    )
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"')
    expect(svg).toContain('viewBox="0 0 32 32"')
    // Two tracks, one fill: a bar with no data has nothing to fill.
    expect(svg.match(/<rect /g)).toHaveLength(3)
    expect(svg).toContain('width="13" height="10" rx="2" fill="rgb(74,222,128)" fill-opacity="1"')
    expect(svg).toContain('fill="rgb(148,163,184)" fill-opacity="0.43"')
  })
})
