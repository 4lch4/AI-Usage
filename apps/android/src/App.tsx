import { formatDuration, formatPercent, levelFor } from '@ai-usage/core/format'
import { iconColorCss } from '@ai-usage/core/icon-layout'
import { createOpenCodeGoProvider } from '@ai-usage/core/providers/opencode-go'
import { refreshAll } from '@ai-usage/core/refresh'
import type { ProviderId, ProviderUsage } from '@ai-usage/core/types'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import { forgetApiKey, loadApiKey, saveApiKey } from './apiKey'

/**
 * The Usage screen, the phone's version of the tray Panel. It shows OpenCode Go only: Claude's
 * Pro and Max sign-ins may not be used by third-party apps, so Claude stays on the PC for now.
 */
export default function App() {
  const dark = useColorScheme() === 'dark'
  const theme = dark ? DARK : LIGHT
  // `undefined` until the saved key has been read, so the key form doesn't flash on launch.
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined)
  const [results, setResults] = useState<ProviderUsage[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [editingKey, setEditingKey] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const previous = useRef(new Map<ProviderId, ProviderUsage>())

  const refresh = useCallback(async (key: string) => {
    setRefreshing(true)
    const provider = createOpenCodeGoProvider({ apiKey: async () => key })
    const next = await refreshAll([provider], previous.current)
    previous.current = new Map(next.map(result => [result.id, result]))
    setResults(next)
    setNow(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadApiKey().then(key => {
      setApiKey(key ?? null)
      if (key) void refresh(key)
    })
  }, [refresh])

  // Keeps the reset countdowns current between refreshes.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  if (apiKey === undefined) return <View style={[styles.screen, theme.screen]} />

  if (apiKey === null || editingKey) {
    return (
      <KeyForm
        theme={theme}
        canCancel={apiKey !== null}
        onCancel={() => setEditingKey(false)}
        onSave={async key => {
          await saveApiKey(key)
          setApiKey(key)
          setEditingKey(false)
          previous.current = new Map()
          void refresh(key)
        }}
      />
    )
  }

  return (
    <View style={[styles.screen, theme.screen]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh(apiKey)} />
        }>
        <Text style={[styles.title, theme.text]}>AI Usage</Text>
        {results.map(result => (
          <ProviderCard key={result.id} result={result} now={now} theme={theme} />
        ))}
        <View style={styles.actions}>
          <Button theme={theme} label="Change API key" onPress={() => setEditingKey(true)} />
          <Button
            theme={theme}
            label="Forget API key"
            onPress={async () => {
              await forgetApiKey()
              previous.current = new Map()
              setResults([])
              setApiKey(null)
            }}
          />
        </View>
      </ScrollView>
    </View>
  )
}

function ProviderCard({ result, now, theme }: { result: ProviderUsage; now: Date; theme: Theme }) {
  return (
    <View style={[styles.card, theme.card]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, theme.text]}>{result.name}</Text>
        {result.stale ? <Text style={[styles.badge, theme.muted]}>Stale</Text> : null}
      </View>
      {result.error ? <Text style={styles.error}>{result.error}</Text> : null}
      {result.windows.map(window => {
        const level = levelFor(window.usedPercent)
        return (
          <View key={window.id} style={styles.window}>
            <View style={styles.windowRow}>
              <Text style={theme.text}>{window.label}</Text>
              <Text style={theme.text}>{formatPercent(window.usedPercent)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: iconColorCss('track') }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, Math.max(0, window.usedPercent))}%`,
                    backgroundColor: iconColorCss(level),
                  },
                ]}
              />
            </View>
            {window.resetsAt ? (
              <Text style={[styles.reset, theme.muted]}>
                Resets in {formatDuration(window.resetsAt.getTime() - now.getTime())}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function KeyForm(props: {
  theme: Theme
  canCancel: boolean
  onCancel: () => void
  onSave: (key: string) => Promise<void>
}) {
  const { theme } = props
  const [value, setValue] = useState('')
  return (
    <View style={[styles.screen, theme.screen]}>
      <View style={styles.content}>
        <Text style={[styles.title, theme.text]}>OpenCode API key</Text>
        <Text style={[styles.help, theme.muted]}>
          Create one at opencode.ai under your workspace's API Keys. It stays on this phone.
        </Text>
        <TextInput
          style={[styles.input, theme.input]}
          value={value}
          onChangeText={setValue}
          placeholder="Paste your key"
          placeholderTextColor={theme.muted.color}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <View style={styles.actions}>
          {props.canCancel ? (
            <Button theme={theme} label="Cancel" onPress={props.onCancel} />
          ) : null}
          <Button
            theme={theme}
            label="Save"
            disabled={value.trim() === ''}
            onPress={() => void props.onSave(value)}
          />
        </View>
      </View>
    </View>
  )
}

function Button(props: { theme: Theme; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.button, props.theme.card, props.disabled && styles.disabled]}>
      <Text style={props.theme.text}>{props.label}</Text>
    </Pressable>
  )
}

const LIGHT = {
  screen: { backgroundColor: '#F8FAFC' },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  text: { color: '#0F172A' },
  muted: { color: '#64748B' },
  input: { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', color: '#0F172A' },
}

const DARK: Theme = {
  screen: { backgroundColor: '#0F172A' },
  card: { backgroundColor: '#1E293B', borderColor: '#334155' },
  text: { color: '#F1F5F9' },
  muted: { color: '#94A3B8' },
  input: { backgroundColor: '#1E293B', borderColor: '#475569', color: '#F1F5F9' },
}

type Theme = typeof LIGHT

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 48, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  help: { fontSize: 14 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  badge: { fontSize: 12 },
  error: { color: '#F87171' },
  window: { gap: 4 },
  windowRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8 },
  reset: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  disabled: { opacity: 0.5 },
})
