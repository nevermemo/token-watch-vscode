// Text and colours for the status bar, the tooltip and the panel, from a
// snapshot: the same thresholds, palette and spellings as the mod. Pure, so
// node:test covers it.

import { current, type Snapshot, type SnapshotCategory, type SnapshotWindow } from './snapshot'

// The mod's palette: what is still available, and the reserve past the
// auto-compact point a step darker.
export const TRACK = '#3d4250'
export const RESERVE = '#2e3139'

// Percentages and usage bars: plain below 50%, yellow from 50%, red from 80%.
export type Level = 'ok' | 'warning' | 'error'
export const LEVEL_COLORS: Record<Level, string> = { ok: '#8fd18f', warning: '#e8c66a', error: '#e06c6c' }

// The legend's shorter names for the longer category labels.
const LEGEND: Record<string, string> = {
  'system prompt': 'system',
  'memory files': 'memory',
  'mcp tools': 'mcp',
}

// Colours for categories Claude Code names by a theme key (such as
// "green_FOR_SUBAGENTS_ONLY") rather than a hex value, which a webview
// cannot draw: picked by the label, so a category keeps its colour.
const FALLBACK_COLORS = ['#6fbf73', '#c39bd3', '#f0b27a', '#76d7c4', '#85c1e9', '#f1948a']

// A category's colour as CSS: its own when it is a hex value, otherwise a
// fallback chosen by its label.
export function categoryColor(color: string, label: string): string {
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export function level(percent: number): Level {
  if (percent < 50) return 'ok'
  if (percent < 80) return 'warning'
  return 'error'
}

// Time left until a window resets: "3d 4h", "2h 14m", "9m".
export function countdown(resetsAt: string | null, nowMs: number): string {
  if (resetsAt === null) return ''
  const ms = Date.parse(resetsAt) - nowMs
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'now'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${Math.max(1, minutes)}m`
}

// A token count: "1M", "212k", "4.9k", "312".
export function short(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

// How long ago: "12s", "3m", "2h 14m", "3d 4h".
export function age(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
  return `${minutes}m`
}

// The windows as they stand now, in the snapshot's order.
export function windowsNow(snapshot: Snapshot, nowMs: number): SnapshotWindow[] {
  return snapshot.windows.map(w => current(w, nowMs))
}

// One window's part of the status bar line, with its level.
export type StatusCell = { key: string; text: string; level: Level }

export type StatusOptions = {
  showContext: boolean
  showBars: boolean
  // 'alerts': only the meters from 50% up.
  show: 'all' | 'alerts'
}

// The status bar's cells: "5H ▏░░░░░ 2%", "WK ▏░░░░░ 2%", "CTX ▎░░░░░ 4%",
// or without the meters "5H 2%". A usage window from 80% up also says when
// it resets: "5H ████▉░ 82% · 41m".
export function statusCells(snapshot: Snapshot, nowMs: number, options: StatusOptions): StatusCell[] {
  const cell = (key: string, label: string, percent: number, resetsAt: string | null): StatusCell => {
    const l = level(percent)
    const meter = options.showBars ? ` ${meterText(percent)}` : ''
    const left = l === 'error' ? countdown(resetsAt, nowMs) : ''
    return { key, text: `${label}${meter} ${Math.round(percent)}%${left ? ` · ${left}` : ''}`, level: l }
  }
  const cells = windowsNow(snapshot, nowMs).map(w => cell(w.kind, w.label, w.percentUsed, w.resetsAt))
  if (options.showContext && snapshot.context !== null) {
    cells.push(cell('context', 'CTX', snapshot.context.percent, null))
  }
  return options.show === 'alerts' ? cells.filter(c => c.level !== 'ok') : cells
}

// The cells as one line, for text that is not the status bar.
export function statusText(snapshot: Snapshot, nowMs: number, showContext: boolean, showBars = false): string {
  const cells = statusCells(snapshot, nowMs, { showContext, showBars, show: 'all' })
  return cells.length > 0 ? cells.map(c => c.text).join(' · ') : 'Token Watch: no reading yet'
}

// A status bar meter: METER_CELLS cells filled in eighths, so 2% already
// shows a sliver, then a light shade for what is still available: "████▉░".
// Pure proportion with no minimum, as the mod's bars are.
const METER_CELLS = 6
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
export function meterText(percent: number): string {
  const eighths = Math.round((Math.max(0, Math.min(100, percent)) / 100) * METER_CELLS * 8)
  const full = Math.floor(eighths / 8)
  const part = EIGHTHS[eighths % 8]
  return '█'.repeat(full) + part + '░'.repeat(METER_CELLS - full - (part ? 1 : 0))
}

// What separates the windows on the status bar line: two em spaces, as wide
// as four monospaced characters (ordinary spaces are narrow in the status
// bar's proportional font, and a run of them folds into one).
export const CELL_GAP = ' '.repeat(2)

// The highest level among what the status bar shows.
export function worstLevel(snapshot: Snapshot, nowMs: number, showContext: boolean): Level {
  const percents = windowsNow(snapshot, nowMs).map(w => w.percentUsed)
  if (showContext && snapshot.context !== null) percents.push(snapshot.context.percent)
  const rank: Record<Level, number> = { ok: 0, warning: 1, error: 2 }
  return percents.map(level).reduce<Level>((worst, l) => (rank[l] > rank[worst] ? l : worst), 'ok')
}

// The context's categories in the legend's order: used ones, largest first.
export function legend(context: Snapshot['context']): SnapshotCategory[] {
  if (context === null) return []
  return context.categories.filter(c => c.kind === 'used').sort((a, b) => b.tokens - a.tokens)
}

export function legendName(category: SnapshotCategory): string {
  return LEGEND[category.label] ?? category.label
}

// The tooltip: the panel in miniature. A hover renders only a sanitized
// subset of HTML, with no CSS boxes, so each bar is a small SVG image (data
// URIs are allowed there) in a table laid out like the panel's rows, and each
// legend swatch is a tiny SVG too. The extension sets supportHtml for it.
export function tooltipMarkdown(snapshot: Snapshot, nowMs: number): string {
  const model = panelModel(snapshot, nowMs, false)
  const parts: string[] = []
  if (model.rows.length > 0) {
    const rows = model.rows.map(row => {
      const percent = row.color
        ? `<span style="color:${row.color};">${row.percent}%</span>`
        : `${row.percent}%`
      return (
        `<tr><td>${escapeHtml(row.label)}&nbsp;&nbsp;</td>` +
        `<td>${svgImage(barSvg(row.segments), TIP_BAR_WIDTH, TIP_BAR_HEIGHT)}</td>` +
        `<td align="right">&nbsp;&nbsp;${percent}</td>` +
        `<td>&nbsp;&nbsp;${escapeHtml(row.detail)}</td></tr>`
      )
    })
    parts.push(`<table>${rows.join('')}</table>`)
  } else {
    parts.push('No reading yet.')
  }
  const context = snapshot.context
  if (context !== null && context.compactsAt !== null) {
    parts.push(`Auto-compacts at ${short(context.compactsAt)}.`)
  }
  if (model.legend.length > 0) {
    parts.push(
      model.legend
        .map(item => `${svgImage(swatchSvg(item.color), 14, 8)}&nbsp;${escapeHtml(item.name)} ${item.tokens}`)
        .join('&nbsp;&nbsp;&nbsp;'),
    )
  }
  const footer = [`snapshot ${age(nowMs - Date.parse(snapshot.writtenAt))} ago`]
  if (snapshot.session.cwd) footer.push(`session in ${codeSpan(snapshot.session.cwd)}`)
  parts.push(`_Token Watch · ${footer.join(' · ')}_`)
  parts.push(TOOLTIP_ACTIONS)
  return parts.join('\n\n')
}

// The tooltip's links: the panel, and the meters on or off (a left click on
// a meter does the same). The extension trusts exactly these two commands.
export const TOOLTIP_COMMANDS = ['tokenWatch.showPanel', 'tokenWatch.toggleBars']
const TOOLTIP_ACTIONS = '[$(graph) Open panel](command:tokenWatch.showPanel) · [Meters on/off](command:tokenWatch.toggleBars)'

// A tooltip bar's size in pixels: as thin as the panel's.
const TIP_BAR_WIDTH = 180
const TIP_BAR_HEIGHT = 8

// One bar as SVG: its segments side by side, each as wide as its share.
export function barSvg(segments: { color: string; share: number }[]): string {
  let x = 0
  const rects = segments.map(segment => {
    const width = Math.max(0, segment.share) * TIP_BAR_WIDTH
    const rect = `<rect x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${TIP_BAR_HEIGHT}" fill="${segment.color}"/>`
    x += width
    return rect
  })
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TIP_BAR_WIDTH}" height="${TIP_BAR_HEIGHT}">` +
    `<clipPath id="r"><rect width="${TIP_BAR_WIDTH}" height="${TIP_BAR_HEIGHT}" rx="2"/></clipPath>` +
    `<g clip-path="url(#r)">${rects.join('')}</g></svg>`
  )
}

function swatchSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="8"><rect width="14" height="8" rx="2" fill="${color}"/></svg>`
}

function svgImage(svg: string, width: number, height: number): string {
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
  return `<img src="${uri}" width="${width}" height="${height}">`
}

// A path as inline code. A backtick in it would end the code span early, so
// it becomes a quote mark.
function codeSpan(text: string): string {
  return '`' + text.replace(/`/g, '‘') + '`'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// The tooltip while there is no live snapshot.
export function waitingMarkdown(snapshotPath: string, snapshot: Snapshot | null, nowMs: number): string {
  const lines = [
    '**Token Watch** is waiting for a snapshot from Claude Code.',
    `It reads ${codeSpan(snapshotPath)}, which the [Token Watch mod](https://github.com/nevermemo/token-watch) writes after each response while a Claude Code session is open: the terminal, the desktop app or the VS Code chat panel.`,
    'Install the mod: `claude plugin marketplace add nevermemo/token-watch`, then `claude plugin install token-watch@token-watch`.',
  ]
  if (snapshot !== null) lines.push(`_Last snapshot ${age(nowMs - Date.parse(snapshot.writtenAt))} ago._`)
  return lines.join('\n\n')
}

// What the panel draws, laid out here so the webview only places boxes: a
// row per window and one for the context, each a label, bar segments as
// shares of the bar, a percentage with its level colour, and a detail; then
// the legend and a footer.
export type PanelRow = {
  label: string
  segments: { color: string; share: number }[]
  percent: number
  color: string | null
  detail: string
}

export type PanelModel = {
  rows: PanelRow[]
  legend: { name: string; color: string; tokens: string }[]
  footer: string
  waiting: string | null
}

export function panelModel(snapshot: Snapshot | null, nowMs: number, stale: boolean): PanelModel {
  if (snapshot === null) return { rows: [], legend: [], footer: '', waiting: 'Waiting for Claude Code: no snapshot yet.' }
  const rows: PanelRow[] = windowsNow(snapshot, nowMs).map(w => {
    const used = Math.max(0, Math.min(100, w.percentUsed))
    return {
      label: w.label,
      segments: [
        { color: LEVEL_COLORS[level(used)], share: used / 100 },
        { color: TRACK, share: 1 - used / 100 },
      ],
      percent: Math.round(w.percentUsed),
      color: percentColor(w.percentUsed),
      detail: countdown(w.resetsAt, nowMs),
    }
  })
  const context = snapshot.context
  if (context !== null) {
    // Largest category first, as the legend lists them, then the free
    // space as track, then the reserve past the auto-compact point.
    const segments = [
      ...legend(context).map(c => ({ color: categoryColor(c.color, c.label), share: c.tokens / context.window })),
      ...context.categories.filter(c => c.kind === 'free').map(c => ({ color: TRACK, share: c.tokens / context.window })),
    ]
    const reserve = context.compactsAt !== null ? Math.max(0, context.window - context.compactsAt) : 0
    if (reserve > 0) segments.push({ color: RESERVE, share: reserve / context.window })
    rows.push({
      label: 'CTX',
      segments,
      percent: context.percent,
      color: percentColor(context.percent),
      detail: `${short(context.total)} / ${short(context.window)}`,
    })
  }
  const footer = [`snapshot ${age(nowMs - Date.parse(snapshot.writtenAt))} ago`]
  if (snapshot.session.cwd) footer.push(snapshot.session.cwd)
  return {
    rows,
    legend: legend(context).map(c => ({ name: legendName(c), color: categoryColor(c.color, c.label), tokens: short(c.tokens) })),
    footer: footer.join(' · '),
    waiting: stale ? 'The last session has ended; waiting for Claude Code.' : null,
  }
}

function percentColor(percent: number): string | null {
  const l = level(percent)
  return l === 'ok' ? null : LEVEL_COLORS[l]
}
