## Agent skills

### Issue tracker

Issues live in this repository's GitHub Issues, accessed through the `gh` CLI.

### Domain docs

This is a single-context repository; domain context lives in the root `CONTEXT.md` and ADRs in `docs/adr/`.

## Working here

- Bun and strict TypeScript. `bun run check`, `bun run typecheck` and `bun test` must pass; husky runs them on commit.
- Bun workspaces. `packages/core` (`@ai-usage/core`) is plain TypeScript with injected dependencies and is fully unit-tested. `apps/windows` is the thin Electrobun layer (tray, popup) and has no tests, so keep logic out of it. Apps import core by subpath, such as `@ai-usage/core/settings`, and never import each other.
- The root `package.json` holds the one version Release Please bumps; workspace packages stay at `0.0.0`. Root scripts (`dev`, `build`, `probe`) run inside `apps/windows`.
- `scripts/Get-AIUsage.ps1` is the original PowerShell probe, kept for checking the data sources without Bun.
- Settings live in `%APPDATA%\AI-Usage\settings.json` and are only written from the shell. The Panel sends patches, so never let the page write the file. See [ADR 2](docs/adr/0002-settings-and-alerts.md).
- When touching the shell, read Electrobun's source rather than assuming an API works. `getTrayBounds` is a stub on Windows and the tray does not report which button was clicked; see [ADR 1](docs/adr/0001-electrobun-tray-shell.md).
