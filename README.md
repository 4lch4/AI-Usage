# AI Usage

A small Windows tray app, in the spirit of [CodexBar](https://github.com/steipete/CodexBar), that shows how
much of your Claude and OpenCode Go/Zen usage limits you've used and when they reset.

It shows two meters in the tray icon (Claude on top, OpenCode Go below; each shows its busiest window) and a
summary on hover. The tray menu has **Show usage** (a popup with every window and its reset countdown),
**Refresh now** and **Quit**. It refreshes every 5 minutes (`AI_USAGE_REFRESH_SECONDS`, minimum 60).

## Run it

Needs [Bun](https://bun.sh) 1.4+ on Windows 10 or 11.

```powershell
bun install
bun run dev        # run the tray app with hot reload
bun run build      # package a build
bun run probe      # print current usage once, without the tray app
bun test
```

**Claude** needs a Claude Code sign-in on this PC (open `claude` once if the token has expired).
**OpenCode Go** needs an API key from opencode.ai (workspace > API Keys), saved so new terminals see it:

```powershell
setx OPENCODE_API_KEY "<key>"
```

The app also reads the saved user variable directly, so it works even when launched from somewhere that
didn't inherit it.

The tray shell uses [Electrobun](https://electrobun.dev), which is in beta; see
[ADR 1](docs/adr/0001-electrobun-tray-shell.md).

## PowerShell probe

```powershell
.\scripts\Get-AIUsage.ps1         # table
.\scripts\Get-AIUsage.ps1 -Json   # JSON, the shape the tray app will consume
```

| Provider     | Source                                                                    | Needs                                                                 |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Claude       | `GET https://api.anthropic.com/api/oauth/usage` (5-hour and weekly)       | A Claude Code sign-in in `~/.claude/.credentials.json`                |
| OpenCode Go  | `GET https://opencode.ai/zen/go/v1/usage` (5-hour, weekly, monthly)       | An API key from opencode.ai (workspace > API Keys) via `-OpenCodeApiKey` or `$env:OPENCODE_API_KEY` |
| OpenCode Zen | `opencode.ai/console/api/billing/status` (prepaid balance)                | `-OpenCodeCookie` or `$env:OPENCODE_COOKIE` from a signed-in browser |

If the Claude token has expired, open `claude` once so Claude Code refreshes it, then rerun the script.

Works in Windows PowerShell 5.1 and PowerShell 7.
