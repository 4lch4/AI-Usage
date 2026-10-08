import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, BuildConfig, Screen, Tray, Utils } from 'electrobun/main'
import { type Alert, describeAlert, detectAlerts } from '../core/alert.ts'
import { applyAutostart, readAutostart } from '../core/autostart.ts'
import { formatTooltip, worstPercent } from '../core/format.ts'
import { type IconSlot, renderTrayIcon } from '../core/icon.ts'
import {
  PANEL_HEIGHT,
  PANEL_WIDTH,
  parsePanelMessage,
  renderPanelHtml,
  scriptJson,
  toPanelPayload,
} from '../core/panel.ts'
import { positionInWorkArea, positionPanel } from '../core/position.ts'
import { createClaudeProvider } from '../core/providers/claude.ts'
import { createOpenCodeGoProvider } from '../core/providers/opencode-go.ts'
import { refreshAll } from '../core/refresh.ts'
import {
  DEFAULT_SETTINGS,
  isVisible,
  loadSettings,
  mergeSettings,
  type Settings,
  saveSettings,
} from '../core/settings.ts'
import type { Provider, ProviderId, ProviderUsage } from '../core/types.ts'

const providers: Provider[] = [createClaudeProvider(), createOpenCodeGoProvider()]
/** Row order in the tray icon and the Providers list, so both stay stable as things are toggled. */
const PROVIDER_ORDER = providers.map(p => p.id)
const iconDir = join(tmpdir(), 'ai-usage')
const configDir = Utils.paths.config

/**
 * Autostart needs a command that still works at login. `bun run dev` does not qualify: it is a
 * Hutch watch session, and the launcher is only the thing to point at in a packaged build, where
 * Electrobun spawns it with CREATE_NO_WINDOW. Refusing in dev keeps a Run entry from reloading the
 * app on every login.
 */
const isPackaged = BuildConfig.getSync().isPackaged
const launcherPath = process.execPath

let settings: Settings = { ...DEFAULT_SETTINGS }
let results: ProviderUsage[] = []
let panel: BrowserWindow | undefined
let panelVisible = false
let openWithSettings = false
let iconCounter = 0
let refreshing = false
let timer: ReturnType<typeof setInterval> | undefined
let alerted = new Set<string>()

// Settings load before the Tray is built, not after. The Tray's first icon is drawn from the
// current settings, so loading them afterwards draws the default providers for a frame and then
// redraws: a Provider switched off flickers into existence on every launch.
settings = await loadSettings({ configDir })

if (isPackaged) {
  // The registry is the truth: an entry can survive the app being moved or the folder being deleted.
  const state = await readAutostart(launcherPath)
  if (state.stale && !settings.autostart) {
    // Ours, but pointing at an old path. Drop it rather than launching something else at login.
    try {
      await applyAutostart(false, launcherPath)
    } catch (error) {
      console.error('Could not remove a stale autostart entry:', error)
    }
  } else if (state.enabled !== settings.autostart) {
    settings = { ...settings, autostart: state.enabled }
    try {
      await saveSettings(settings, { configDir })
    } catch (error) {
      console.error('Could not save settings:', error)
    }
  }
}

const tray = new Tray({
  title: 'AI Usage: loading…',
  image: await writeIcon(),
  template: false,
  width: 32,
  height: 32,
})
tray.setMenu([
  { type: 'normal', label: 'Show usage', action: 'show' },
  { type: 'normal', label: 'Settings…', action: 'settings' },
  { type: 'normal', label: 'Refresh now', action: 'refresh' },
  { type: 'separator' },
  { type: 'normal', label: 'Quit', action: 'quit' },
])

tray.on('tray-clicked', event => {
  const action = (event as { data?: { action?: string } }).data?.action
  if (action === 'refresh') void refresh()
  else if (action === 'quit') quit()
  else if (action === 'settings') openPanel(true)
  else togglePanel()
})

/** The Providers the user has switched on, in icon order. */
function visibleResults(): ProviderUsage[] {
  return results.filter(r => isVisible(settings, r.id))
}

function iconSlots(): IconSlot[] {
  return PROVIDER_ORDER.map(id => ({
    value: worstPercent(results.find(r => r.id === id)),
    visible: isVisible(settings, id),
  }))
}

async function writeIcon(): Promise<string> {
  // A fresh file name each time, so the tray never serves a cached image.
  await mkdir(iconDir, { recursive: true })
  const path = join(iconDir, `tray-${process.pid}-${iconCounter++}.ico`)
  await writeFile(path, renderTrayIcon(iconSlots()))
  if (iconCounter > 2)
    await rm(join(iconDir, `tray-${process.pid}-${iconCounter - 3}.ico`), { force: true })
  return path
}

function panelPayload() {
  return toPanelPayload(results, new Date(), {
    settings,
    allProviders: PROVIDER_ORDER.map((id, index) => ({
      id,
      name: providers[index]?.name ?? id,
    })),
    autostartAvailable: isPackaged,
    openSettings: openWithSettings,
  })
}

async function refresh(): Promise<void> {
  if (refreshing) return
  refreshing = true
  try {
    const previous = new Map<ProviderId, ProviderUsage>(results.map(r => [r.id, r]))
    results = await refreshAll(providers, previous)
    const shown = visibleResults()
    tray.setImage(await writeIcon())
    tray.setTitle(formatTooltip(shown))
    announce(shown)
    pushToPanel()
  } catch (error) {
    // Providers already report their own failures; this only catches tray and icon trouble.
    // Logging keeps a bad refresh from killing the app on the timer or at startup.
    console.error('Refresh failed to reach the tray:', error)
  } finally {
    refreshing = false
  }
}

function announce(shown: ProviderUsage[]): void {
  const { alerts, alerted: next } = detectAlerts(shown, alerted, settings.alertAtPercent)
  alerted = next
  for (const alert of alerts) notify(alert)
}

function notify(alert: Alert): void {
  try {
    const { title, body } = describeAlert(alert)
    Utils.showNotification({ title, body })
  } catch (error) {
    console.error('Could not show the near-limit notification:', error)
  }
}

function pushToPanel(): void {
  if (!panel) return
  // The popup's HTML is loaded a moment after the window exists, so a refresh that lands in
  // that gap would otherwise run against a blank page and throw inside the webview.
  panel.webview.executeJavascript(`if (window.render) window.render(${scriptJson(panelPayload())})`)
}

/**
 * Where the Panel goes, in logical pixels.
 *
 * `tray.getBounds()` is a stub on Windows and reports a zero rectangle, so anchoring to the icon is
 * not possible there yet. The work area is what is left after the taskbar, which is where the tray
 * lives: its bottom-right corner is the notification area on a taskbar that is bottom-aligned.
 * `positionPanel` still prefers real icon bounds wherever they are reported.
 */
function panelSpot(): { x: number; y: number } | null {
  const size = { width: PANEL_WIDTH, height: PANEL_HEIGHT }
  const display = Screen.getPrimaryDisplay()
  return (
    positionPanel(tray.getBounds(), size, display.bounds) ??
    positionInWorkArea(size, display.workArea)
  )
}

function placePanel(): void {
  const spot = panelSpot()
  if (spot) panel?.setFrame(spot.x, spot.y, PANEL_WIDTH, PANEL_HEIGHT)
}

function openPanel(withSettings: boolean): void {
  openWithSettings = withSettings
  if (panel) {
    placePanel()
    if (withSettings)
      panel.webview.executeJavascript('window.openSettings && window.openSettings()')
    pushToPanel()
    panel.show()
  } else {
    const spot = panelSpot()
    panel = new BrowserWindow({
      title: 'AI Usage',
      html: renderPanelHtml(panelPayload()),
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
    panel.webview.on('host-message', event => {
      const detail = (event as { data?: { detail?: unknown } }).data?.detail
      if (detail) onHostMessage(detail)
    })
    if (!spot) panel.center()
  }
  panel.activate()
  panelVisible = true
}

function togglePanel(): void {
  if (panel && panelVisible) {
    panel.hide()
    panelVisible = false
    return
  }
  openPanel(false)
}

function onHostMessage(detail: unknown): void {
  const message = parsePanelMessage(detail)
  if (!message) return
  if (message.type === 'autostart') {
    void setAutostart(message.enabled)
    return
  }
  if (message.type === 'providerVisibility') {
    const { id, visible } = message
    const next = PROVIDER_ORDER.filter(p => (p === id ? visible : isVisible(settings, p)))
    void applySettings(mergeSettings(settings, { visibleProviders: next }))
    return
  }
  void applySettings(mergeSettings(settings, message.patch))
}

function restartTimer(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(() => void refresh(), settings.refreshSeconds * 1000)
}

async function setAutostart(enabled: boolean): Promise<void> {
  if (!isPackaged) return
  try {
    await applyAutostart(enabled, launcherPath)
  } catch (error) {
    // Report rather than leave the checkbox lying: a failed write means autostart is still off.
    console.error('Could not change autostart:', error)
    pushToPanel()
    return
  }
  await applySettings(mergeSettings(settings, { autostart: enabled }))
}

async function applySettings(next: Settings): Promise<void> {
  const intervalChanged = next.refreshSeconds !== settings.refreshSeconds
  settings = next
  try {
    await saveSettings(settings, { configDir })
  } catch (error) {
    console.error('Could not save settings:', error)
  }
  tray.setImage(await writeIcon())
  tray.setTitle(formatTooltip(visibleResults()))
  if (intervalChanged) restartTimer()
  pushToPanel()
}

function quit(): void {
  tray.remove()
  process.exit(0)
}

await refresh()
restartTimer()
console.log(
  `AI Usage running; refreshing every ${settings.refreshSeconds}s. Settings in ${configDir}.`,
)
