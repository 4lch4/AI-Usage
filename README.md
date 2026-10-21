# AI Usage

A small Windows tray app, in the spirit of [CodexBar](https://github.com/steipete/CodexBar), that shows how
much of your Claude and OpenCode Go/Zen usage limits you've used and when they reset.

It shows two meters in the tray icon (Claude on top, OpenCode Go below; each shows its busiest window) and a
summary on hover. The tray menu has **Show usage** (a popup with every window and its reset countdown),
**Settings…**, **Refresh now** and **Quit**. It refreshes every 5 minutes.

A left-click opens the tray menu, not the popup; use **Show usage**. See
[ADR 1](docs/adr/0001-electrobun-tray-shell.md) for why.

## Settings

Open the popup and click **Settings** in the footer, or pick **Settings…** from the tray menu. You can set:

| Setting              | Choices                        | Default   |
| -------------------- | ------------------------------ | --------- |
| Refresh every        | 1, 5, 15, 30 minutes           | 5 minutes |
| Warn me at           | 70%, 80%, 90%, 95% used        | 90%       |
| Show in the tray     | Claude, OpenCode Go            | both      |
| Start with Windows  | on / off                       | off       |

Autostart writes a `HKCU\...\CurrentVersion\Run` entry pointing at the app's `launcher.exe`, so it
needs no administrator rights and shows up in Task Manager's **Startup** tab where you can turn it off
without the app. It is only offered in a packaged build: `bun run dev` is a Hutch watch session, and a
Run entry pointing at it would reload the app at every login.

A Provider you switch off draws no tray meter, disappears from the popup, and stops raising warnings.

You get one Windows notification the first time a window reaches your threshold. It stays quiet
after that until the window drops back below, so a Provider sitting at 95% does not notify every five
minutes.

Settings live in `%APPDATA%\AI-Usage\settings.json`. It is hand-editable: a missing, partial or
corrupt file falls back to the defaults field by field rather than losing your tray. The file is read
once at startup, so **Quit and relaunch** after editing it. A value you set by hand is added to that
Setting's dropdown, so the panel shows what is really in effect even if it isn't one of the listed
choices.

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

The tray shell uses [Electrobun](https://electrobun.dev) (pinned to a stable release); see
[ADR 1](docs/adr/0001-electrobun-tray-shell.md).

## Android

`apps/android` is an Expo app that shows **OpenCode Go** usage on your phone. Claude is not on the
phone: see [ADR 4](docs/adr/0004-android-app.md). On first launch, paste your OpenCode API key; it
stays on the phone. Pull down to refresh.

There is also a 1x1 home-screen widget: long-press the home screen, pick **Widgets**, and add **AI
Usage**. It shows your busiest OpenCode Go limit over the same two meters as the tray icon (5-hour
on top, the fuller of weekly and monthly below). Android refreshes it every 30 minutes, and opening
the app refreshes it at once. Tap it to open the app.

Every PR's CI run builds a test APK, **ai-usage-android-test**, under the run's artifacts. It is signed
with Expo's debug key, so uninstall it before installing a signed release. To build one yourself you
need JDK 17 and the Android SDK:

```sh
cd apps/android
bun run build:apk   # android/app/build/outputs/apk/release/app-release.apk
```

## Install

Download the latest `AI-Usage-<version>-win-x64-setup.zip` from the
[releases page](https://github.com/4lch4/AI-Usage/releases), extract it, and run `AI Usage-Setup.exe`
from the extracted folder. Keep the `.installer` folder next to it: that is the app itself,
and Setup fails without it. The app installs to
`%LOCALAPPDATA%\com.4lch4.ai-usage` with Start Menu and Desktop shortcuts.

It is **not code-signed**, so SmartScreen will warn the first time. Click **More info** →
**Run anyway**.

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
