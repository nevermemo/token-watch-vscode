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

// The status bar's text: "5H 62% · WK 31% · CTX 21%".
export function statusText(snapshot: Snapshot, nowMs: number, showContext: boolean): string {
  const parts = windowsNow(snapshot, nowMs).map(w => `${w.label} ${Math.round(w.percentUsed)}%`)
  if (showContext && snapshot.context !== null) parts.push(`CTX ${snapshot.context.percent}%`)
  return parts.length > 0 ? parts.join(' · ') : 'Token Watch: no reading yet'
}

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

// The tooltip, as Markdown: each window with its countdown, the context with
// its auto-compact point and categories largest first, the snapshot's age.
export function tooltipMarkdown(snapshot: Snapshot, nowMs: number): string {
  const lines: string[] = []
  for (const w of windowsNow(snapshot, nowMs)) {
    const left = countdown(w.resetsAt, nowMs)
    lines.push(`**${w.label}** ${Math.round(w.percentUsed)}%${left ? ` · resets in ${left}` : ''}`)
  }
  const context = snapshot.context
  if (context !== null) {
    const compacts = context.compactsAt !== null ? ` · auto-compacts at ${short(context.compactsAt)}` : ''
    lines.push(`**CTX** ${context.percent}% · ${short(context.total)} of ${short(context.window)}${compacts}`)
    const parts = legend(context).map(c => `${legendName(c)} ${short(c.tokens)}`)
    if (parts.length > 0) lines.push(parts.join(' · '))
  }
  if (lines.length === 0) lines.push('No reading yet.')
  const footer = [`snapshot ${age(nowMs - Date.parse(snapshot.writtenAt))} ago`]
  if (snapshot.session.cwd) footer.push(`session in \`${snapshot.session.cwd}\``)
  lines.push(`_Token Watch · ${footer.join(' · ')}_`)
  return lines.join('\n\n')
}

// The tooltip while there is no live snapshot.
export function waitingMarkdown(snapshotPath: string, snapshot: Snapshot | null, nowMs: number): string {
  const lines = [
    '**Token Watch** is waiting for a snapshot from Claude Code.',
    `It reads \`${snapshotPath}\`, which the [Token Watch mod](https://github.com/nevermemo/token-watch) writes after each response while a Claude Code session is open: the terminal, the desktop app or the VS Code chat panel.`,
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
