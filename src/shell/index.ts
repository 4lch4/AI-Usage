import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, Tray } from 'electrobun/main'
import { formatTooltip, worstPercent } from '../core/format.ts'
import { renderTrayIcon } from '../core/icon.ts'
import {
  PANEL_HEIGHT,
  PANEL_WIDTH,
  renderPanelHtml,
  scriptJson,
  toPanelPayload,
} from '../core/panel.ts'
import { positionPanel } from '../core/position.ts'
import { createClaudeProvider } from '../core/providers/claude.ts'
import { createOpenCodeGoProvider } from '../core/providers/opencode-go.ts'
import { refreshAll } from '../core/refresh.ts'
import type { ProviderId, ProviderUsage } from '../core/types.ts'

const REFRESH_MS = Math.max(60, Number(process.env.AI_USAGE_REFRESH_SECONDS) || 300) * 1000
// Used only to keep the panel on screen; Windows hands the tray icon's bounds in logical pixels.
const SCREEN = { width: 3840, height: 2160 }

const providers = [createClaudeProvider(), createOpenCodeGoProvider()]
const iconDir = join(tmpdir(), 'ai-usage')

let results: ProviderUsage[] = []
let panel: BrowserWindow | undefined
let panelVisible = false
let iconCounter = 0
let refreshing = false

const tray = new Tray({
  title: 'AI Usage: loading…',
  image: await writeIcon([null, null]),
  template: false,
  width: 32,
  height: 32,
})
tray.setMenu([
  { type: 'normal', label: 'Show usage', action: 'show' },
  { type: 'normal', label: 'Refresh now', action: 'refresh' },
  { type: 'separator' },
  { type: 'normal', label: 'Quit', action: 'quit' },
])

tray.on('tray-clicked', event => {
  const action = (event as { data?: { action?: string } }).data?.action
  if (action === 'refresh') void refresh()
  else if (action === 'quit') quit()
  else togglePanel()
})

async function writeIcon(values: [number | null, number | null]): Promise<string> {
  // A fresh file name each time, so the tray never serves a cached image.
  await mkdir(iconDir, { recursive: true })
  const path = join(iconDir, `tray-${process.pid}-${iconCounter++}.png`)
  await writeFile(path, renderTrayIcon(values))
  if (iconCounter > 2)
    await rm(join(iconDir, `tray-${process.pid}-${iconCounter - 3}.png`), { force: true })
  return path
}

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const previous = new Map<ProviderId, ProviderUsage>(results.map(r => [r.id, r]))
    results = await refreshAll(providers, previous)
    const [claude, opencode] = ['claude', 'opencode-go'].map(id =>
      worstPercent(results.find(r => r.id === id)),
    )
    tray.setImage(await writeIcon([claude ?? null, opencode ?? null]))
    tray.setTitle(formatTooltip(results))
    pushToPanel()
  } catch (error) {
    // Providers already report their own failures; this only catches tray and icon trouble.
    // Logging keeps a bad refresh from killing the app on the timer or at startup.
    console.error('Refresh failed to reach the tray:', error)
  } finally {
    refreshing = false
  }
}

function pushToPanel(): void {
  if (!panel) return
  // The popup's HTML is loaded a moment after the window exists, so a refresh that lands in
  // that gap would otherwise run against a blank page and throw inside the webview.
  panel.webview.executeJavascript(
    `if (window.render) window.render(${scriptJson(toPanelPayload(results, new Date()))})`,
  )
}

function placePanel(window: BrowserWindow): void {
  const spot = positionPanel(tray.getBounds(), { width: PANEL_WIDTH, height: PANEL_HEIGHT }, SCREEN)
  if (spot) window.setFrame(spot.x, spot.y, PANEL_WIDTH, PANEL_HEIGHT)
  else window.center()
}

function togglePanel(): void {
  if (panel && panelVisible) {
    panel.hide()
    panelVisible = false
    return
  }
  if (!panel) {
    const spot = positionPanel(
      tray.getBounds(),
      { width: PANEL_WIDTH, height: PANEL_HEIGHT },
      SCREEN,
    )
    panel = new BrowserWindow({
      title: 'AI Usage',
      html: renderPanelHtml(toPanelPayload(results, new Date())),
      frame: { x: spot?.x, y: spot?.y, width: PANEL_WIDTH, height: PANEL_HEIGHT },
      titleBarStyle: 'hidden',
    })
    panel.setAlwaysOnTop(true)
    panel.on('blur', () => {
      panel?.hide()
      panelVisible = false
    })
    panel.on('close', () => {
      panel = undefined
      panelVisible = false
    })
    if (!spot) panel.center()
  } else {
    placePanel(panel)
    pushToPanel()
    panel.show()
  }
  panel.activate()
  panelVisible = true
}

function quit(): void {
  tray.remove()
  process.exit(0)
}

await refresh()
setInterval(() => void refresh(), REFRESH_MS)
console.log(`AI Usage running; refreshing every ${REFRESH_MS / 1000}s.`)
