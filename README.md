# AI Usage

A small Windows tray app, in the spirit of [CodexBar](https://github.com/steipete/CodexBar), that shows how
much of your Claude and OpenCode Go/Zen usage limits you've used and when they reset.

The tray app is still being built. For now, `scripts/Get-AIUsage.ps1` checks that the data sources work on
your machine.

## Usage probe

```powershell
.\scripts\Get-AIUsage.ps1         # table
.\scripts\Get-AIUsage.ps1 -Json   # JSON, the shape the tray app will consume
```

| Provider     | Source                                                                    | Needs                                                                 |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Claude       | `GET https://api.anthropic.com/api/oauth/usage` (5-hour and weekly)       | A Claude Code sign-in in `~/.claude/.credentials.json`                |
| OpenCode Go  | `GET https://opencode.ai/zen/go/v1/usage` (5-hour, weekly, monthly)       | `-OpenCodeApiKey`, `$env:OPENCODE_API_KEY`, or `opencode auth login`  |
| OpenCode Zen | `opencode.ai/console/api/billing/status` (prepaid balance)                | `-OpenCodeCookie` or `$env:OPENCODE_COOKIE` from a signed-in browser |

If the Claude token has expired, open `claude` once so Claude Code refreshes it, then rerun the script.

Works in Windows PowerShell 5.1 and PowerShell 7.
