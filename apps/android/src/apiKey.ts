import * as SecureStore from 'expo-secure-store'

// Kept in Android Keystore-backed storage. The app opts out of Auto Backup, so the key never
// leaves this phone.
const KEY = 'opencode-api-key'

export async function loadApiKey(): Promise<string | undefined> {
  return (await SecureStore.getItemAsync(KEY))?.trim() || undefined
}

export async function saveApiKey(value: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, value.trim())
}

export async function forgetApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}
