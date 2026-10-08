# 2. Settings are a JSON file the Panel edits, and Alerts fire once per crossing

Status: accepted

Date: 2026-10-08

## Context

The first version hard-coded a five-minute refresh and always showed both Providers. Three things
were wanted: a configurable refresh interval, the ability to switch a Provider off, and a warning
before a rate-limit Window runs out. The shell had to stay thin and untested-friendly, so the
decisions had to live in `src/core` as pure functions.

Two constraints shaped the answer. The Panel is a single HTML string with no front-end build, so it
cannot own state; and the tray shell is the one file with no tests, so anything decided there would be
unverified.

## Decision

**Settings live in one JSON file under the OS config directory (`%APPDATA%\AI-Usage\settings.json` on
Windows). `src/core/settings.ts` owns parsing, clamping and merging, and is a pure function of the
file's contents. Every field has a default, and a field that is missing, the wrong type or out of
range falls back on its own rather than discarding the file.**

**The Panel edits Settings by sending messages to the shell.** A `Settings` button in the popup footer
reveals the controls; each one sends a patch with `__electrobunSendToHost`, and the shell merges it,
saves it and re-applies what changed. No value is written by the page directly, so the file is only
ever written from one place.

**An Alert fires once per crossing.** `detectAlerts` compares each Window against the threshold and
remembers which Windows are already over it, so a Provider sitting at 95% announces once and then
stays quiet until it drops back below. Stale results are skipped: they are numbers from an earlier
Refresh and would re-announce something already reported.

**A hidden Provider draws nothing at all** in the tray icon, not an empty bar, because a dim empty
bar reads as "no data" rather than "switched off".

**The Panel has a fixed height and scrolls inside it.** An earlier version had the Panel report its
own height so the shell could size the window to it. That was reverted: sizing the window to its
contents needs a page-to-shell round trip on every render, and the only thing that round trip can be
used for is measurement. A fixed height with `overflow-y: auto` cannot clip anything, and costs one
scrollbar.

**The page-to-shell channel is parsed by `parsePanelMessage`, not the shell.** Electrobun parses the
`host-message` detail a second time before delivering it, so what arrives is normally an object even
though the page sent a string. Parsing only a string dropped every message silently: the Panel
rendered and responded to clicks, while its Settings did nothing. That parse lives in `src/core` so
it is covered by tests rather than discovered on Windows.

## Consequences

- Settings parsing, clamping, round-tripping, the Panel message protocol and the Alert state machine
  are all covered by `bun test` on any OS. The untested shell only forwards patches and calls the
  already-tested functions.
- The Panel shows an explicit warning when `__electrobunSendToHost` is missing, so a broken bridge
  reports itself instead of presenting dead controls.
- The saved file is a public interface. Renaming a Setting silently resets it to the default, and a
  user edit that is merely the wrong type degrades one field rather than the whole file.
- The interval choices and the alert thresholds are defined in `settings.ts` and shipped to the Panel
  in the payload, so the two dropdowns cannot drift from the values the code accepts.
- Only the refresh interval restarts the timer. Toggling a Provider rewrites the icon, tooltip and
  Panel, which is cheap and immediate.
- Autostart was deliberately deferred: registering a startup entry needs a stable command to launch,
  and there is no packaged executable yet. It belongs with the packaging work so it can be verified.