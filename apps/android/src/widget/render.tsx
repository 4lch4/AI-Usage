import { createOpenCodeGoProvider } from '@ai-usage/core/providers/opencode-go'
import { refreshAll } from '@ai-usage/core/refresh'
import type { ProviderUsage } from '@ai-usage/core/types'
import { requestWidgetUpdate, type WidgetRepresentation } from 'react-native-android-widget'
import { loadApiKey } from '../apiKey'
import { UsageWidget, WIDGET_NAME } from './UsageWidget'

/** Both themes, so the launcher picks the one matching the phone's dark mode. */
export function usageWidget(usage: ProviderUsage | undefined, note?: string): WidgetRepresentation {
  return {
    light: <UsageWidget usage={usage} note={note} theme="light" />,
    dark: <UsageWidget usage={usage} note={note} theme="dark" />,
  }
}

/**
 * Fetches OpenCode Go and draws the widget, for when Android asks for an update with the app
 * closed. Without a saved key it asks to be tapped, which opens the app's key form.
 */
export async function freshUsageWidget(): Promise<WidgetRepresentation> {
  const apiKey = await loadApiKey()
  if (!apiKey) return usageWidget(undefined, 'Set key')
  const provider = createOpenCodeGoProvider({ apiKey: async () => apiKey })
  const [usage] = await refreshAll([provider], new Map())
  return usageWidget(usage)
}

/** Redraws every placed widget with numbers the app already has, so the two never disagree. */
export function showOnWidget(usage: ProviderUsage | undefined, note?: string): void {
  void requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => usageWidget(usage, note),
  }).catch(() => {
    // No widget placed, or the launcher is unavailable: the app itself is unaffected.
  })
}
