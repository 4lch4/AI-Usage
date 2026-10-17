import { iconColorCss, iconLayout, iconSvg } from '@ai-usage/core/icon-layout'
import type { ProviderUsage } from '@ai-usage/core/types'
import { widgetView } from '@ai-usage/core/widget'
import { type ColorProp, FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget'

/** The name the config plugin registers the widget under, and the app updates it by. */
export const WIDGET_NAME = 'Usage'

const THEMES: Record<'light' | 'dark', { background: ColorProp; text: ColorProp }> = {
  light: { background: '#FFFFFF', text: '#0F172A' },
  dark: { background: '#1E293B', text: '#F1F5F9' },
}

interface Props {
  /** `undefined` before the first refresh, or when there is no API key. */
  usage: ProviderUsage | undefined
  /** Shown in place of a percentage when there is nothing to measure, such as "Set key". */
  note?: string
  theme: 'light' | 'dark'
}

/**
 * The 1x1 home-screen widget: OpenCode Go's busiest Window as a percentage over the same two
 * meters the tray icon draws. Tapping it opens the app.
 */
export function UsageWidget({ usage, note, theme }: Props) {
  const view = widgetView(usage)
  const colors = THEMES[theme]
  const captionColor =
    view.level === 'unknown' ? colors.text : (iconColorCss(view.level) as ColorProp)
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        borderRadius: 16,
        padding: 4,
      }}>
      <TextWidget
        text={note ?? view.caption}
        style={{ fontSize: note ? 11 : 15, fontWeight: 'bold', color: captionColor }}
      />
      <SvgWidget svg={iconSvg(iconLayout(view.slots))} style={{ height: 34, width: 34 }} />
    </FlexWidget>
  )
}
