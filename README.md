# Token Watch for VS Code

**Your Claude Code plan usage and context window in the VS Code status bar.**

Token Watch for VS Code shows `5H ▰▰▰▰▰▱▱▱ 62% · WK ▰▰▱▱▱▱▱▱ 31% · CTX ▰▰▱▱▱▱▱▱ 21%` in the status bar: the 5-hour and weekly usage windows of your Claude subscription, any other window Claude Code reports (a model's own allowance, a gateway's spend limit), and how full the current session's context window is. Hover for the reset countdowns and the context breakdown; click for a panel that draws the same bars as the [Token Watch](https://github.com/nevermemo/token-watch) mod for Claude Code.

It is that mod's companion and needs it: the mod writes a small snapshot file after each response, and this extension reads it. The VS Code extension's chat panel shows no mod drawings, which is why the band lives in the status bar here.

## Requirements

1. **Claude Code** with the **Token Watch mod 1.1.0 or later**: `claude plugin marketplace add nevermemo/token-watch`, then `claude plugin install token-watch@token-watch`.
2. A Claude Code session running on this machine: the terminal, the desktop app, or the VS Code chat panel. Until one has written a snapshot, the item reads `Token Watch: waiting for Claude Code`.

## Install

1. Download `token-watch-0.1.0.vsix` from the [releases page](https://github.com/nevermemo/token-watch-vscode/releases).
2. Install it, either from a shell:

   ```bash
   code --install-extension token-watch-0.1.0.vsix
   ```

   or in VS Code with Extensions → ⋯ → Install from VSIX….

Then reload VS Code. The item appears on the right of the status bar.

The extension is not yet published to the VS Code Marketplace or Open VSX.

## What it shows

| Where | What |
|-------|------|
| Status bar | A pulse icon, then one item per meter: `5H ▰▰▰▰▰▱▱▱ 62%`, `WK ▰▰▱▱▱▱▱▱ 31%`, `CTX ▰▰▱▱▱▱▱▱ 21%`. Each takes its own colour: green below 50%, yellow from 50%, and from 80% the error background with the time until that window resets (`5H ▰▰▰▰▰▰▰▱ 82% · 41m`). **Click a meter** to turn the meters on or off (`5H 82% · 41m`). **Click the icon** to open the panel. |
| Tooltip | The panel in miniature: a row per meter with its coloured bar, percentage and reset countdown or token count, the auto-compact point, the legend, the snapshot's age, and links to open the panel or turn the meters on or off. |
| Panel (click the icon, the tooltip's link, or **Token Watch: Show Panel**) | The mod's bars: a meter per window, the context broken down by category with the free space as a grey track and the reserve past the auto-compact point darker, and the legend. It refreshes as the snapshot changes. |

- A window whose reset time has passed shows 0% until the next response.
- When no session has written for 150 seconds, or the file is missing, the meters give way to a dim `Token Watch: waiting for Claude Code`.
- VS Code gives extensions no right-click on a status bar item (its context menu, for hiding items, is VS Code's own), so the panel opens from the icon or the tooltip.

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `tokenWatch.snapshotPath` | `""` | The snapshot's path. Empty means `~/.claude/token-watch/usage.json`; `~` is expanded. |
| `tokenWatch.showContext` | `true` | Show `CTX` in the status bar. |
| `tokenWatch.showBars` | `true` | Draw the meter beside each percentage. A click on a meter flips this. |
| `tokenWatch.show` | `all` | `alerts` shows only the meters from 50% up, for a crowded status bar; the icon stays. |
| `tokenWatch.alignment` | `right` | Which side of the status bar the group sits on. |

## Commands

- **Token Watch: Show Panel**
- **Token Watch: Meters On/Off**
- **Token Watch: Refresh**: reads the snapshot again now (it is also read on every change and every 30 seconds).

## Privacy

Read-only. The extension reads one file, the snapshot the mod writes, watches its folder for changes, and keeps a 30-second timer. No network requests and no telemetry. The only thing it writes is its own `tokenWatch.showBars` setting, when you click a meter. The snapshot's format is documented in the mod's README under "The usage snapshot".

## Development

```bash
npm install
npm run build
npm test            # node:test over the pure modules: parsing, formatting, thresholds, staleness
npx @vscode/vsce package
```

`src/snapshot.ts` (the file's shape, path and staleness) and `src/format.ts` (status text, tooltip, panel model) have no VS Code dependency, so the tests need no VS Code harness. `src/extension.ts` wires them to the status bar, the watcher and the panel; `src/panel.ts` is the panel's page.

This project is not affiliated with Anthropic.

## License

[Apache License 2.0](LICENSE).
