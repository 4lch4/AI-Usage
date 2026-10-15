# AI Usage

AI Usage is a small Windows tray app that shows how much of your AI plan limits you have used and
when they reset, in the spirit of CodexBar. It watches two Providers today: Claude and OpenCode Go.

## Language

**Provider**:
A service whose plan limits the app reads. Each Provider turns its own API response into a list of
Windows and reports its own failures. The app never shows a number it didn't get from a Provider.
_Avoid_: Service, integration, account, source

**Window**:
One rate-limit period of a Provider, such as Claude's 5-hour session or OpenCode Go's weekly
allowance. A Window has a used percentage (0 to 100) and, when known, a reset time.
_Avoid_: Limit, quota, meter, bucket

**Refresh**:
One attempt to read every Provider. Providers fail independently: a failed Refresh keeps the
Provider's last good Windows and marks them stale instead of blanking the tray.
_Avoid_: Poll, sync, update

**Stale**:
A Provider's Windows came from an earlier Refresh because the latest one failed. Stale numbers are
always labeled as such.

**Panel**:
The small popup that opens when you click the tray icon, with a card per Provider.
_Avoid_: Popover, flyout, window (a Window is a rate-limit period)

**Settings**:
The user's saved choices: how often to Refresh, which Providers to show, and when to Alert. Every
Setting has a default, so a missing or hand-edited file is never fatal.
_Avoid_: Options, preferences, config, flags

**Alert**:
A one-time notification that a Window has reached the near-limit threshold. A Provider Alerts once
per crossing and stays quiet until the Window drops back below, so it does not repeat every Refresh.
_Avoid_: Warning, notification (the mechanism, not the decision), push

## Relationships

- A **Provider** has zero or more **Windows**.
- A **Refresh** produces exactly one result per **Provider**.
- The tray icon draws one bar per **Provider**, showing its busiest **Window**.
- **Settings** decide which **Providers** are shown; a **Provider** switched off draws no bar and
  raises no **Alert**.
