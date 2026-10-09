# Changelog

## 0.1.0 (2026-10-09)

First release.

- Status bar item `5H ▰▰▰▰▰▱▱▱ 62% · WK ▰▰▱▱▱▱▱▱ 31% · CTX ▰▰▱▱▱▱▱▱ 21%`, an 8-cell meter beside each percentage, from the Token Watch mod's snapshot (`~/.claude/token-watch/usage.json`), with the warning colour from 50% and the error colour from 80%.
- Tooltip that looks like the panel in miniature: a row per meter with its coloured bar, percentage and reset countdown or token count, the auto-compact point, the legend with colour swatches, and the snapshot's age.
- Panel that draws the mod's bars and legend, refreshed live.
- Watches the snapshot's folder, ticks every 30 seconds, and dims to `Token Watch: waiting for Claude Code` when the snapshot is missing or older than 150 seconds.
- Settings `tokenWatch.snapshotPath`, `tokenWatch.showContext`, `tokenWatch.showBars`, `tokenWatch.alignment`; commands **Token Watch: Show Panel** and **Token Watch: Refresh**.
- Read-only: no network, no telemetry, no writes.
- Works in Restricted Mode (untrusted folders): it reads only the snapshot, never workspace files.
- The panel comes back in place when VS Code restarts, and fits a narrow column: the bars shrink first, then the countdowns step aside.
- Categories Claude Code colours by a theme name rather than a hex value get a steady fallback colour.
