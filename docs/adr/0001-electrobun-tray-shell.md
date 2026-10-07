# 1. Electrobun is the tray shell, and everything else is plain TypeScript

Status: accepted

Date: 2026-10-07

## Context

The app has to live in the Windows tray, show a live meter in the icon and a small popup on click,
and be written in TypeScript on Bun. The options were Electrobun (Bun main process, native tray API,
system webview), Tauri (Rust core, TypeScript front end), and Electron. Electrobun is the only one
that keeps the whole app in TypeScript on Bun without shipping a bundled Chromium, and its Windows
tray reports a click with an empty action and exposes the icon's bounds, which is what a popup needs.

Electrobun is in beta (2.0.3-beta.11 when this was written), and the shell cannot be exercised on
Linux CI.

## Decision

**The Electrobun layer is kept as thin as possible. `src/shell/index.ts` wires a tray, a timer and a
popup window together; all behavior lives in `src/core` as pure functions with injected `fetch`,
clock and file access.**

The popup is a single HTML string rendered by `src/core/panel.ts` and refreshed by calling
`window.render(payload)`, so there is no separate front-end build. The tray icon is a PNG drawn by
`src/core/icon.ts`, so there are no image assets either.

## Consequences

- Everything that can be wrong in a way that matters (parsing, stale handling, tooltips, icon pixels,
  popup placement) is covered by `bun test` on any OS.
- If Electrobun's beta breaks or Windows tray behavior surprises us, replacing the shell means
  rewriting one file; Tauri is the fallback.
- The shell itself is only verified by running it on Windows.
