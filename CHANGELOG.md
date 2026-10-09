# Changelog

## 0.1.0 (2026-10-09)

First release.

- Status bar: a pulse icon that opens the panel, then one line of meters, `5H ████▉░ 82% · 41m    WK ██▏░░░ 35%    CTX █▌░░░░ 26%`, on the warning background from 50% and the error background from 80%, when the window's reset time is added. A click on the meters turns them on or off.
- Tooltip that looks like the panel in miniature: a row per meter with its coloured bar, percentage and reset countdown or token count, the auto-compact point, the legend with colour swatches, and the snapshot's age, with links to open the panel or turn the meters on or off.
- Panel that draws the mod's bars and legend, refreshed live.
- Watches the snapshot's folder, ticks every 30 seconds, and dims to `Token Watch: waiting for Claude Code` when the snapshot is missing or older than 150 seconds.
- Settings `tokenWatch.snapshotPath`, `tokenWatch.showContext`, `tokenWatch.showBars`, `tokenWatch.show` (`alerts` for only the meters from 50% up), `tokenWatch.alignment`; commands **Token Watch: Show Panel**, **Token Watch: Meters On/Off** and **Token Watch: Refresh**.
- Reads only the snapshot: no network, no telemetry; the one write is its own `tokenWatch.showBars` setting when a meter is clicked.
- Works in Restricted Mode (untrusted folders): it reads only the snapshot, never workspace files.
- The panel comes back in place when VS Code restarts, and fits a narrow column: the bars shrink first, then the countdowns step aside.
- Categories Claude Code colours by a theme name rather than a hex value get a steady fallback colour.
