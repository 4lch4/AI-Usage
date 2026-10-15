import { type Provider, ProviderError, type ProviderId, type ProviderUsage } from './types.ts'

function describe(error: unknown): string {
  if (error instanceof ProviderError) return error.message
  const message = error instanceof Error ? error.message : String(error)
  return `Could not reach the service (${message}).`
}

/**
 * Refreshes every provider independently. A provider that fails keeps showing its last good
 * numbers, marked stale, so a brief network blip doesn't blank the tray.
 */
export async function refreshAll(
  providers: Provider[],
  previous: ReadonlyMap<ProviderId, ProviderUsage>,
  now: Date = new Date(),
): Promise<ProviderUsage[]> {
  return Promise.all(
    providers.map(async (provider): Promise<ProviderUsage> => {
      try {
        const windows = await provider.fetchWindows()
        return { id: provider.id, name: provider.name, windows, fetchedAt: now }
      } catch (error) {
        const last = previous.get(provider.id)
        return {
          id: provider.id,
          name: provider.name,
          windows: last?.windows ?? [],
          fetchedAt: last?.fetchedAt ?? now,
          error: describe(error),
          stale: (last?.windows.length ?? 0) > 0,
        }
      }
    }),
  )
}
