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

Reading the SDK and the Windows native wrapper settles four questions the shell depends on:

- `Tray.on('tray-clicked')` and `BrowserWindow.on('blur')` / `on('close')` are real events.
- `setImage` takes an absolute path; `Tray.resolveImagePath` only rewrites `views://` URLs.
- **`getTrayBounds` is a stub on Windows.** It returns `{x:0,y:0,width:0,height:0}`, so
  `positionPanel` always returns null there and the Panel is centered rather than anchored to the
  icon. Placement is therefore correct in principle but unproven on the target OS.
- **A left-click on the tray opens the context Menu, not the Panel.** Once `setMenu` is installed the
  Windows wrapper routes both `WM_LBUTTONUP` and `WM_RBUTTONUP` to `TrackPopupMenu`, and the
  empty-action `tray-clicked` the shell treats as "toggle Panel" only arrives when no Menu exists.
  Opening the Panel from a left-click is not available with a Menu attached.

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
- The Panel opens from the **Show usage** Menu item rather than a left-click, because installing a
  Menu takes over left-click on Windows. Worth revisiting if Electrobun exposes the icon's bounds
  for real, which would also let the Panel be anchored to the icon.
