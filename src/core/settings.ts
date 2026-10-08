import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ProviderId } from './types.ts'

/** The app's saved choices. Everything here has a default, so a missing file is not an error. */
export interface Settings {
  /** Seconds between Refreshes. */
  refreshSeconds: number
  /** Which Providers the tray icon, tooltip and Panel show. May be empty. */
  visibleProviders: ProviderId[]
  /** Used percent at which a Window counts as near its limit. */
  alertAtPercent: number
  /**
   * Start with Windows. Ignored in a dev build, where there is nothing stable to launch: `bun run
   * dev` is a Hutch watch session, and a Run entry pointing at it would run a reloading process at
   * every login. Reported in the Panel as unavailable there. See ADR 3.
   */
  autostart: boolean
}

/** Offered in the Panel's Settings section. */
export const REFRESH_CHOICES = [60, 300, 900, 1800] as const
export const ALERT_CHOICES = [70, 80, 90, 95] as const

/** The same floor the shell has always applied to `AI_USAGE_REFRESH_SECONDS`. */
export const MIN_REFRESH_SECONDS = 60
const MAX_REFRESH_SECONDS = 86_400

export const DEFAULT_SETTINGS: Settings = {
  refreshSeconds: 300,
  visibleProviders: ['claude', 'opencode-go'],
  alertAtPercent: 90,
  autostart: false,
}

const ALL_PROVIDERS: readonly ProviderId[] = ['claude', 'opencode-go']

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function parseVisible(value: unknown): ProviderId[] {
  if (!Array.isArray(value)) return [...DEFAULT_SETTINGS.visibleProviders]
  const known = value.filter((id): id is ProviderId => ALL_PROVIDERS.includes(id as ProviderId))
  // Duplicates would double a Provider's bar in the tray icon.
  return ALL_PROVIDERS.filter(id => known.includes(id))
}

/**
 * Reads Settings out of untrusted JSON, falling back field by field.
 *
 * The file is hand-editable, so a stale or partial one must never cost the user their tray: every
 * field that is missing, the wrong type or out of range falls back to its default.
 */
export function parseSettings(raw: unknown): Settings {
  const record = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>
  return {
    refreshSeconds: clampNumber(
      record.refreshSeconds,
      MIN_REFRESH_SECONDS,
      MAX_REFRESH_SECONDS,
      DEFAULT_SETTINGS.refreshSeconds,
    ),
    visibleProviders: parseVisible(record.visibleProviders),
    alertAtPercent: clampNumber(record.alertAtPercent, 1, 100, DEFAULT_SETTINGS.alertAtPercent),
    // Only ever true from a file we wrote ourselves.
    autostart: record.autostart === true,
  }
}

export function serializeSettings(settings: Settings): string {
  return `${JSON.stringify(parseSettings(settings), null, 2)}\n`
}

/** `settings.json` under the OS config directory, e.g. `%APPDATA%\AI-Usage\settings.json`. */
export function settingsPath(configDir: string, appName = 'AI-Usage'): string {
  return join(configDir, appName, 'settings.json')
}

export interface SettingsDeps {
  configDir: string
  readText?: (path: string) => Promise<string>
  writeText?: (path: string, text: string) => Promise<void>
  makeDir?: (path: string) => Promise<void>
}

const defaultReadText = (path: string) => readFile(path, 'utf8')
const defaultWriteText = (path: string, text: string) => writeFile(path, text, 'utf8')
const defaultMakeDir = (path: string) => mkdir(path, { recursive: true })

/** Never throws: unreadable or corrupt Settings fall back to the defaults. */
export async function loadSettings(deps: SettingsDeps): Promise<Settings> {
  const path = settingsPath(deps.configDir)
  try {
    const text = await (deps.readText ?? defaultReadText)(path)
    return parseSettings(JSON.parse(text))
  } catch {
    return { ...DEFAULT_SETTINGS, visibleProviders: [...DEFAULT_SETTINGS.visibleProviders] }
  }
}

export async function saveSettings(settings: Settings, deps: SettingsDeps): Promise<void> {
  const path = settingsPath(deps.configDir)
  await (deps.makeDir ?? defaultMakeDir)(dirname(path))
  await (deps.writeText ?? defaultWriteText)(path, serializeSettings(settings))
}

/** Applies a partial change, as sent by one control in the Panel's Settings section. */
export function mergeSettings(current: Settings, patch: Partial<Settings>): Settings {
  return parseSettings({ ...current, ...patch })
}

export function isVisible(settings: Settings, id: ProviderId): boolean {
  return settings.visibleProviders.includes(id)
}
