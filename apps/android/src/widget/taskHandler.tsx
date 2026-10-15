import type { WidgetTaskHandlerProps } from 'react-native-android-widget'
import { freshUsageWidget } from './render'

/**
 * Runs headless when Android adds, resizes or periodically updates the widget (every 30 minutes,
 * the shortest period Android allows), so the numbers move even when the app is never opened.
 */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(await freshUsageWidget())
      break
    default:
      break
  }
}
