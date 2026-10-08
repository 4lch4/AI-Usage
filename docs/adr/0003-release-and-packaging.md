# 3. Release Please tags the version and CI builds the unsigned Windows bundle

Status: accepted

Date: 2026-10-08

## Context

The app needed a build someone could install, and a way to cut a version without hand-editing files.
Conventions were copied from the owner's Shion repository so the two repos behave the same. Electrobun
is a beta, so the build step is the most likely thing to break in CI, and its output layout is
produced by Hutch rather than by anything in this repo.

The `.exe` cannot be signed: that needs a code-signing certificate, which is not a free dependency.

## Decision

**Release Please owns versioning.** It maintains an open `chore(main): release X.Y.Z` PR; merging it
bumps `package.json`, writes `CHANGELOG.md`, tags and creates the GitHub Release. The tag push then
triggers the build workflow, which attaches the app bundle as a zip to that release. `bump-minor-pre-major`
is enabled so a `0.x` app gets minor bumps rather than being treated as unstable patches.

**The build runs on `windows-2025` and is unsigned.** SmartScreen warns on first run and the user
clicks through. That is the accepted trade-off, not an oversight.

**The build job verifies before it builds.** It checks the tag matches
`.release-please-manifest.json` and runs lint, typecheck and tests, so a tag that disagrees with the
manifest fails loudly instead of publishing a mislabelled artifact.

**The Release Please workflow needs a PAT, not `GITHUB_TOKEN`.** Resources created with
`GITHUB_TOKEN` do not trigger workflows, so the tag would never reach the build job and nothing would
be published — a silent failure, which is why it is called out in a comment there.

## Consequences

- A release is: merge to `main`, merge the release PR, download the zip, unzip, run `launcher.exe`.
  There is no installer and no Start Menu entry; the app is a portable folder.
- Autostart points the `Run` entry at that folder's `launcher.exe`, so **moving the folder breaks
  autostart**. This is why the app reads the registry on startup and drops its own stale entry rather
  than launching whatever now occupies the old path.
- An unsigned build cannot be distributed to other machines smoothly, and no auto-update is offered.
- The notification's Windows title still needs checking in a packaged build: the toast is a
  `Shell_NotifyIcon` balloon with no AppUserModelID, so Windows names it after the host process.