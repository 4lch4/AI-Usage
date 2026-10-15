import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

/**
 * The Windows installer takes its version from `electrobun.config.ts`, not `package.json`. Release
 * Please only rewrites the config's version line because of the annotation on it, so losing the
 * annotation would quietly ship every build as the old version. See ADR 3.
 */
describe('release versioning', () => {
  const packageVersion = (JSON.parse(read('package.json')) as { version: string }).version
  const manifestVersion = (
    JSON.parse(read('.release-please-manifest.json')) as Record<string, string>
  )['.']
  const configLine = read('electrobun.config.ts')
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
      'electrobun.config.ts',
    )
  })

  test('releases start as drafts and still get their tag', () => {
    const config = JSON.parse(read('.github/release-please-config.json')) as Record<string, unknown>
    expect(config.draft).toBe(true)
    // A draft has no tag until it is published, so without this the tag push that starts the build
    // never happens and the draft is never filled in.
    expect(config['force-tag-creation']).toBe(true)
  })
})
