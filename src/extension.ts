// Token Watch for VS Code: the usage snapshot the Token Watch mod writes,
// shown in the status bar, a tooltip and a panel. Read-only: it reads one
// file, watches its folder, and ticks every 30 seconds for the countdowns
// and the staleness. No network, no telemetry, no writes.

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'

import { panelModel, statusText, tooltipMarkdown, waitingMarkdown, worstLevel } from './format'
import { panelHtml } from './panel'
import { isStale, parseSnapshot, resolveSnapshotPath, type Snapshot } from './snapshot'

const TICK_MS = 30_000
const DEBOUNCE_MS = 100
const RETRY_MS = 200

export function activate(context: vscode.ExtensionContext): void {
  const watch = new TokenWatch()
  context.subscriptions.push(
    watch,
    vscode.commands.registerCommand('tokenWatch.showPanel', () => watch.showPanel()),
    vscode.commands.registerCommand('tokenWatch.refresh', () => watch.refresh()),
    // A panel left open when VS Code closed comes back in its place, rather
    // than leaving an empty editor group behind.
    vscode.window.registerWebviewPanelSerializer('tokenWatch.panel', {
      deserializeWebviewPanel: async panel => watch.adoptPanel(panel),
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('tokenWatch')) watch.reconfigure()
    }),
  )
  void watch.refresh()
}

export function deactivate(): void {}

function settings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('tokenWatch')
}

class TokenWatch implements vscode.Disposable {
  private snapshotPath = resolveSnapshotPath(settings().get<string>('snapshotPath'))
  private item = this.makeItem()
  private panel: vscode.WebviewPanel | null = null
  private watcher: fs.FSWatcher | null = null
  private readonly timer = setInterval(() => void this.refresh(), TICK_MS)
  private debounce: NodeJS.Timeout | null = null
  private snapshot: Snapshot | null = null
  // Why the file gave no snapshot: missing, or not a schema-1 snapshot.
  private trouble: 'missing' | 'unreadable' | null = 'missing'

  constructor() {
    this.attachWatcher()
    this.render()
  }

  dispose(): void {
    clearInterval(this.timer)
    if (this.debounce !== null) clearTimeout(this.debounce)
    this.detachWatcher()
    this.panel?.dispose()
    this.item.dispose()
  }

  // Settings changed: a new path, or a new side for the item.
  reconfigure(): void {
    this.snapshotPath = resolveSnapshotPath(settings().get<string>('snapshotPath'))
    this.item.dispose()
    this.item = this.makeItem()
    this.attachWatcher()
    void this.refresh()
  }

  // Reads the file and redraws. A parse failure is retried once, since the
  // mod writes the file in place and a read can land mid-write.
  async refresh(): Promise<void> {
    let snapshot = await this.read()
    if (snapshot === null && this.trouble === 'unreadable') {
      await new Promise(resolve => setTimeout(resolve, RETRY_MS))
      snapshot = await this.read()
    }
    if (snapshot !== null) this.snapshot = snapshot
    if (this.watcher === null) this.attachWatcher()
    this.render()
  }

  private async read(): Promise<Snapshot | null> {
    let text: string
    try {
      text = await fs.promises.readFile(this.snapshotPath, 'utf8')
    } catch {
      this.trouble = 'missing'
      return null
    }
    const snapshot = parseSnapshot(text)
    this.trouble = snapshot === null ? 'unreadable' : null
    return snapshot
  }

  private render(): void {
    const now = Date.now()
    const showContext = settings().get<boolean>('showContext', true)
    const snapshot = this.snapshot
    const live = snapshot !== null && this.trouble !== 'missing' && !isStale(snapshot, now)
    if (snapshot === null || !live) {
      this.item.text = '$(watch) Token Watch: waiting for Claude Code'
      this.item.color = new vscode.ThemeColor('disabledForeground')
      this.item.backgroundColor = undefined
      this.item.tooltip = markdown(waitingMarkdown(this.snapshotPath, snapshot, now))
    } else {
      this.item.text = `$(pulse) ${statusText(snapshot, now, showContext, settings().get<boolean>('showBars', true))}`
      this.item.color = undefined
      const level = worstLevel(snapshot, now, showContext)
      this.item.backgroundColor =
        level === 'ok'
          ? undefined
          : new vscode.ThemeColor(level === 'warning' ? 'statusBarItem.warningBackground' : 'statusBarItem.errorBackground')
      this.item.tooltip = markdown(tooltipMarkdown(snapshot, now))
    }
    this.item.show()
    void this.panel?.webview.postMessage({ type: 'model', model: panelModel(snapshot, now, !live) })
  }

  showPanel(): void {
    if (this.panel !== null) {
      this.panel.reveal()
      return
    }
    this.adoptPanel(
      vscode.window.createWebviewPanel('tokenWatch.panel', 'Token Watch', vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
      }),
    )
  }

  // Takes charge of a panel, a new one or one VS Code restored.
  adoptPanel(panel: vscode.WebviewPanel): void {
    this.panel?.dispose()
    this.panel = panel
    panel.webview.options = { enableScripts: true }
    panel.webview.html = panelHtml()
    // The page asks for the figures once its script runs, so a restored
    // panel is never left blank.
    panel.webview.onDidReceiveMessage(message => {
      if ((message as { type?: string } | null)?.type === 'ready') this.render()
    })
    panel.onDidDispose(() => {
      if (this.panel === panel) this.panel = null
    })
    this.render()
  }

  private makeItem(): vscode.StatusBarItem {
    const side =
      settings().get<string>('alignment', 'right') === 'left' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right
    const item = vscode.window.createStatusBarItem('tokenWatch.status', side, 100)
    item.name = 'Token Watch'
    item.command = 'tokenWatch.showPanel'
    return item
  }

  // Watches the snapshot's folder: the file is rewritten in place and may
  // not exist yet. fs.watch on a folder works for a path outside the
  // workspace on Windows, macOS and Linux; a missing folder is retried on
  // each tick.
  private attachWatcher(): void {
    this.detachWatcher()
    const dir = path.dirname(this.snapshotPath)
    const file = path.basename(this.snapshotPath)
    try {
      const watcher = fs.watch(dir, { persistent: false }, (_event, name) => {
        if (name === null || name === file) this.scheduleRefresh()
      })
      watcher.on('error', () => this.detachWatcher())
      this.watcher = watcher
    } catch {
      this.watcher = null
    }
  }

  private detachWatcher(): void {
    this.watcher?.close()
    this.watcher = null
  }

  private scheduleRefresh(): void {
    if (this.debounce !== null) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => {
      this.debounce = null
      void this.refresh()
    }, DEBOUNCE_MS)
  }
}

function markdown(text: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString(text)
  md.supportThemeIcons = true
  // The tooltip's table and SVG bars (VS Code sanitizes the HTML).
  md.supportHtml = true
  return md
}
