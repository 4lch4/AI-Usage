import { formatDuration, formatPercent } from '@ai-usage/core/format'
import { createDesktopProviders } from '@ai-usage/core/node/providers'
import { refreshAll } from '@ai-usage/core/refresh'

/** `bun run probe` prints current usage once, to check the data sources without the tray app. */
const now = new Date()
const results = await refreshAll(createDesktopProviders(), new Map(), now)

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
