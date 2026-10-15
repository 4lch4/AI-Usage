import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS, parseSettings, type Settings, serializeSettings } from '../settings.ts'

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
