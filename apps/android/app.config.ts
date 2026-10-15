import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExpoConfig } from 'expo/config'

/**
 * Android refuses an update whose `versionCode` is not higher than the installed one, so it is
 * derived from the semver version: every bump, even a patch, gives a higher code.
 */
export function versionCode(version: string): number {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) throw new Error(`Not a semver version: ${version}`)
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number]
  if (minor > 999 || patch > 999) throw new Error(`Version ${version} does not fit a versionCode`)
  return major * 1_000_000 + minor * 1_000 + patch
}

// The root package.json is the one version Release Please bumps, for Windows and Android alike.
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
) as {
  version: string
}

const config: ExpoConfig = {
  name: 'AI Usage',
  slug: 'ai-usage',
  scheme: 'aiusage',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.alcha.aiusage',
    versionCode: versionCode(version),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-foreground.png',
      backgroundColor: '#0F172A',
    },
    // The OpenCode API key must not travel to another phone through Auto Backup.
    allowBackup: false,
  },
  plugins: ['expo-secure-store'],
}

export default config
