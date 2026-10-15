import { describe, expect, test } from 'bun:test'
import { ICON_SIZE, iconColorCss, iconLayout } from '../src/icon-layout.ts'

describe('iconLayout', () => {
  test('puts the first slot on top and the second below it', () => {
    const [top, bottom] = iconLayout([
      { value: 50, visible: true },
      { value: 10, visible: true },
    ])
    expect(top).toMatchObject({ x: 3, y: 4, width: 26, height: 10 })
    expect(bottom).toMatchObject({ x: 3, y: 18, width: 26, height: 10 })
    for (const bar of [top, bottom]) {
      expect((bar?.x ?? 0) + (bar?.width ?? 0)).toBeLessThanOrEqual(ICON_SIZE)
      expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(ICON_SIZE)
    }
  })

  test('fills in proportion to the value and colours by level', () => {
    const [half, full, over] = iconLayout([
      { value: 50, visible: true },
      { value: 100, visible: true },
    ]).concat(iconLayout([{ value: 250, visible: true }]))
    expect(half).toMatchObject({ fillWidth: 13, fill: 'ok' })
    expect(full).toMatchObject({ fillWidth: 26, fill: 'critical' })
    expect(over).toMatchObject({ fillWidth: 26, fill: 'critical' })
  })

  test('keeps a sliver for a near-zero value and none for no data', () => {
    const [low, missing] = iconLayout([
      { value: 0, visible: true },
      { value: null, visible: true },
    ])
    expect(low).toMatchObject({ fillWidth: 2, fill: 'ok' })
    expect(missing).toMatchObject({ fillWidth: 0, fill: 'unknown' })
  })

  test('draws nothing for a hidden slot but keeps the other in its own row', () => {
    const bars = iconLayout([
      { value: 40, visible: false },
      { value: 80, visible: true },
    ])
    expect(bars).toHaveLength(1)
    expect(bars[0]).toMatchObject({ y: 18 })
  })

  test('gives the same colours as CSS', () => {
    expect(iconColorCss('ok')).toBe('rgba(74, 222, 128, 1)')
    expect(iconColorCss('track')).toBe('rgba(148, 163, 184, 0.43)')
  })
})
