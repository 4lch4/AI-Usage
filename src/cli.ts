import { formatDuration, formatPercent } from './core/format.ts'
import { createClaudeProvider } from './core/providers/claude.ts'
import { createOpenCodeGoProvider } from './core/providers/opencode-go.ts'
import { refreshAll } from './core/refresh.ts'

/** `bun run probe` prints current usage once, to check the data sources without the tray app. */
const now = new Date()
const results = await refreshAll(
  [createClaudeProvider(), createOpenCodeGoProvider()],
  new Map(),
  now,
)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ fetchedAt: now.toISOString(), usage: results }, null, 2))
} else {
  for (const result of results) {
    console.log(result.name)
    for (const w of result.windows) {
      const reset = w.resetsAt
        ? `resets in ${formatDuration(w.resetsAt.getTime() - now.getTime())}`
        : ''
      console.log(`  ${w.label.padEnd(16)} ${formatPercent(w.usedPercent).padStart(6)}  ${reset}`)
    }
    if (result.error) console.log(`  ! ${result.error}`)
  }
}
