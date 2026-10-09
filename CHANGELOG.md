# Changelog

## 0.1.0 (2026-10-09)

First release.

- Status bar item `5H 62% · WK 31% · CTX 21%` from the Token Watch mod's snapshot (`~/.claude/token-watch/usage.json`), with the warning colour from 50% and the error colour from 80%.
- Tooltip with each window's reset countdown, the context total, auto-compact point and categories, and the snapshot's age.
- Panel that draws the mod's bars and legend, refreshed live.
- Watches the snapshot's folder, ticks every 30 seconds, and dims to `Token Watch: waiting for Claude Code` when the snapshot is missing or older than 150 seconds.
- Settings `tokenWatch.snapshotPath`, `tokenWatch.showContext`, `tokenWatch.alignment`; commands **Token Watch: Show Panel** and **Token Watch: Refresh**.
- Read-only: no network, no telemetry, no writes.
