import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The Windows installer takes its version from `apps/windows/electrobun.config.ts`, not
 * `package.json`. Release Please only rewrites the config's version line because of the annotation
 * on it, so losing the annotation would quietly ship every build as the old version. See ADR 3.
 */
describe('release versioning', () => {
  const packageVersion = (JSON.parse(read('package.json')) as { version: string }).version
  const manifestVersion = (
    JSON.parse(read('.release-please-manifest.json')) as Record<string, string>
  )['.']
  const configLine = read('apps/windows/electrobun.config.ts')
    .split('\n')
    .find(line => /^\s*version:/.test(line))

  test('the manifest and package.json agree', () => {
    expect(manifestVersion).toBe(packageVersion)
  })

  test('the Electrobun version line carries the Release Please annotation', () => {
    expect(configLine).toContain('x-release-please-version')
  })

  test('the Electrobun version matches package.json', () => {
    expect(configLine?.match(/version:\s*'([^']+)'/)?.[1]).toBe(packageVersion)
  })

  test('Release Please also bumps electrobun.config.ts', () => {
    const config = JSON.parse(read('.github/release-please-config.json')) as {
      packages: Record<string, { 'extra-files'?: (string | { path: string })[] }>
    }
    const extra = config.packages['.']?.['extra-files'] ?? []
    expect(extra.map(file => (typeof file === 'string' ? file : file.path))).toContain(
      'apps/windows/electrobun.config.ts',
    )
  })

  test('releases start as drafts and still get their tag', () => {
    const config = JSON.parse(read('.github/release-please-config.json')) as Record<string, unknown>
    expect(config.draft).toBe(true)
    // A draft has no tag until it is published, so without this the tag push that starts the build
    // never happens and the draft is never filled in.
    expect(config['force-tag-creation']).toBe(true)
  })

  test('the release ships Setup together with the payload it unpacks', () => {
    // Setup.exe alone fails with "The installer package is incomplete": it reads these two files
    // from a `.installer` folder beside it, matched by its own file name.
    const workflow = read('.github/workflows/release.yml')
    for (const file of [
      'AI Usage-Setup.exe',
      'AI Usage-Setup.metadata.json',
      'AI Usage-Setup.tar.zst',
    ]) {
      expect(workflow).toContain(`apps/windows/build/stable-win-x64/${file}`)
    }
    expect(workflow).toContain('stage/.installer')
  })
})

describe('Android versioning', async () => {
  const { default: config, versionCode } = await import('../apps/android/app.config.ts')
  const packageVersion = (JSON.parse(read('package.json')) as { version: string }).version

  test('the app takes its version from the root package.json', () => {
    expect(config.version).toBe(packageVersion)
    expect(config.android?.versionCode).toBe(versionCode(packageVersion))
  })

  test('every semver bump gives a higher versionCode', () => {
    const order = ['0.2.2', '0.2.3', '0.3.0', '0.10.0', '1.0.0', '1.0.1', '2.0.0']
    const codes = order.map(versionCode)
    expect(codes).toEqual([...codes].sort((a, b) => a - b))
    expect(new Set(codes).size).toBe(order.length)
    expect(versionCode('1.2.3')).toBe(1_002_003)
  })

  test('refuses a version that does not fit', () => {
    expect(() => versionCode('1.1000.0')).toThrow()
    expect(() => versionCode('banana')).toThrow()
  })
})
