import { createOpenCodeGoProvider } from '../providers/opencode-go.ts'
import type { Provider } from '../types.ts'
import { createClaudeCodeProvider } from './claude-code.ts'
import { readEnv } from './windows-env.ts'

/**
 * The Providers as a desktop app runs them: Claude through Claude Code's saved sign-in, and
 * OpenCode Go with `OPENCODE_API_KEY` from the environment or the saved user variable.
 */
export function createDesktopProviders(): Provider[] {
  return [
    createClaudeCodeProvider(),
    createOpenCodeGoProvider({ apiKey: () => readEnv('OPENCODE_API_KEY') }),
  ]
}
