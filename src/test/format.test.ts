import assert from 'node:assert/strict'
import { test } from 'node:test'

import { age, categoryColor, statusCells, countdown, level, meterText, panelModel, RESERVE, short, statusText, tooltipMarkdown, TRACK, worstLevel } from '../format'
import type { Snapshot } from '../snapshot'

const NOW = Date.parse('2026-10-03T12:00:00Z')
const MINUTE = 60_000
const at = (minutes: number) => new Date(NOW + minutes * MINUTE).toISOString()

const SNAPSHOT: Snapshot = {
  schema: 1,
  writtenAt: new Date(NOW - 12_000).toISOString(),
  session: { id: 'sess-1', cwd: 'C:/proj' },
  windows: [
    { kind: 'five_hour', label: '5H', percentUsed: 62.4, resetsAt: at(2 * 60 + 14) },
    { kind: 'seven_day', label: 'WK', percentUsed: 31, resetsAt: at(3 * 24 * 60 + 4 * 60) },
  ],
  context: {
    total: 212_200,
    window: 1_000_000,
    percent: 21,
    compactsAt: 950_000,
    categories: [
      { label: 'system prompt', tokens: 3_400, color: '#7b9cd8', kind: 'used' },
      { label: 'tools', tokens: 12_000, color: '#7ecfc4', kind: 'used' },
      { label: 'messages', tokens: 186_000, color: '#d97757', kind: 'used' },
      { label: 'free', tokens: 738_000, color: 'inactive', kind: 'free' },
      { label: 'buffer', tokens: 50_000, color: 'inactive', kind: 'buffer' },
    ],
  },
}

test('short spells token counts as the mod does', () => {
  assert.equal(short(1_000_000), '1M')
  assert.equal(short(212_200), '212k')
  assert.equal(short(4_900), '4.9k')
  assert.equal(short(312), '312')
})

test('countdown: days and hours, hours and minutes, minutes, now, none', () => {
  assert.equal(countdown(at(3 * 24 * 60 + 4 * 60), NOW), '3d 4h')
  assert.equal(countdown(at(2 * 60 + 14), NOW), '2h 14m')
  assert.equal(countdown(at(9), NOW), '9m')
  assert.equal(countdown(at(-1), NOW), 'now')
  assert.equal(countdown(null, NOW), '')
})

test('age', () => {
  assert.equal(age(12_000), '12s')
  assert.equal(age(3 * MINUTE), '3m')
  assert.equal(age((2 * 60 + 14) * MINUTE), '2h 14m')
})

test('levels: plain below 50%, warning from 50%, error from 80%', () => {
  assert.equal(level(49.9), 'ok')
  assert.equal(level(50), 'warning')
  assert.equal(level(79.9), 'warning')
  assert.equal(level(80), 'error')
})

test('status text: the windows, then CTX', () => {
  assert.equal(statusText(SNAPSHOT, NOW, true), '5H 62% · WK 31% · CTX 21%')
  assert.equal(statusText(SNAPSHOT, NOW, false), '5H 62% · WK 31%')
  assert.equal(statusText({ ...SNAPSHOT, windows: [] }, NOW, true), 'CTX 21%')
  assert.equal(statusText({ ...SNAPSHOT, windows: [], context: null }, NOW, true), 'Token Watch: no reading yet')
})

test('extra windows keep the snapshot order after 5H and WK', () => {
  const extra: Snapshot = {
    ...SNAPSHOT,
    windows: [
      ...SNAPSHOT.windows,
      { kind: 'seven_day_fable', label: 'FB', percentUsed: 88, resetsAt: at(60) },
      { kind: 'mystery_window', label: 'mystery_window', percentUsed: 5, resetsAt: null },
    ],
  }
  assert.equal(statusText(extra, NOW, true), '5H 62% · WK 31% · FB 88% · 1h 00m · mystery_window 5% · CTX 21%')
  assert.equal(worstLevel(extra, NOW, true), 'error')
})

test('a window whose reset time has passed reads 0% with no countdown', () => {
  const expired: Snapshot = { ...SNAPSHOT, windows: [SNAPSHOT.windows[0], { ...SNAPSHOT.windows[1], percentUsed: 90, resetsAt: at(-1) }] }
  assert.equal(statusText(expired, NOW, true), '5H 62% · WK 0% · CTX 21%')
  assert.equal(worstLevel(expired, NOW, true), 'warning')
  const row = panelModel(expired, NOW, false).rows[1]
  assert.equal(row.percent, 0)
  assert.equal(row.detail, '')
})

test('worst level is the highest shown', () => {
  assert.equal(worstLevel(SNAPSHOT, NOW, true), 'warning')
  assert.equal(worstLevel({ ...SNAPSHOT, windows: [] }, NOW, true), 'ok')
})

test('tooltip: the panel in miniature, a row per meter with an SVG bar, then the legend and the age', () => {
  const md = tooltipMarkdown(SNAPSHOT, NOW)
  const rows = md.match(/<tr>.*?<\/tr>/g) ?? []
  assert.equal(rows.length, 3)
  assert.match(rows[0], /<td>5H&nbsp;&nbsp;<\/td><td><img src="data:image\/svg\+xml;base64,[^"]+" width="180" height="8"><\/td>/)
  assert.match(rows[0], /<span style="color:#e8c66a;">62%<\/span>/)
  assert.match(rows[0], /2h 14m/)
  assert.match(rows[1], /WK.*31%.*3d 4h/)
  assert.match(rows[2], /CTX.*21%.*212k \/ 1M/)
  assert.match(md, /Auto-compacts at 950k\./)
  // Legend largest first, each with a swatch image.
  assert.ok(md.indexOf('messages 186k') < md.indexOf('tools 12k'))
  assert.ok(md.indexOf('tools 12k') < md.indexOf('system 3.4k'))
  assert.match(md, /<img src="data:image\/svg\+xml;base64,[^"]+" width="14" height="8">&nbsp;messages 186k/)
  assert.match(md, /snapshot 12s ago/)
  assert.doesNotMatch(md, /free \d/)
  // The 5H bar draws the used share in its level colour over the track.
  const svg = Buffer.from(rows[0].match(/base64,([^"]+)/)![1], 'base64').toString('utf8')
  assert.match(svg, /<rect x="0\.00" y="0" width="112\.32" height="8" fill="#e8c66a"\/>/)
  assert.match(svg, new RegExp(`fill="${TRACK}"`))
})

test('panel model: usage meters, then the context largest first, free as track, the reserve darker', () => {
  const model = panelModel(SNAPSHOT, NOW, false)
  assert.equal(model.waiting, null)
  assert.deepEqual(model.rows.map(r => r.label), ['5H', 'WK', 'CTX'])
  assert.deepEqual(model.rows[0].segments.map(s => s.color), ['#e8c66a', TRACK])
  assert.equal(model.rows[0].color, '#e8c66a')
  assert.equal(model.rows[1].color, null)
  const ctx = model.rows[2]
  assert.deepEqual(ctx.segments.map(s => s.color), ['#d97757', '#7ecfc4', '#7b9cd8', TRACK, RESERVE])
  assert.deepEqual(ctx.segments.map(s => s.share), [0.186, 0.012, 0.0034, 0.738, 0.05])
  assert.equal(ctx.detail, '212k / 1M')
  assert.deepEqual(model.legend.map(l => `${l.name} ${l.tokens}`), ['messages 186k', 'tools 12k', 'system 3.4k'])
  assert.equal(panelModel(SNAPSHOT, NOW, true).waiting, 'The last session has ended; waiting for Claude Code.')
  assert.equal(panelModel(null, NOW, true).waiting, 'Waiting for Claude Code: no snapshot yet.')
})

test('category colours: hex values pass through, theme names get a stable fallback', () => {
  assert.equal(categoryColor('#d97757', 'messages'), '#d97757')
  const fallback = categoryColor('green_FOR_SUBAGENTS_ONLY', 'mcp server instructions')
  assert.match(fallback, /^#[0-9a-f]{6}$/i)
  assert.equal(categoryColor('promptBorder', 'mcp server instructions'), fallback)
})

test('status meters: six cells filled in eighths, a light shade for the rest, no minimum', () => {
  assert.equal(meterText(0), '░░░░░░')
  assert.equal(meterText(1), '░░░░░░')
  assert.equal(meterText(2), '▏░░░░░')
  assert.equal(meterText(26), '█▌░░░░')
  assert.equal(meterText(35), '██▏░░░')
  assert.equal(meterText(82), '████▉░')
  assert.equal(meterText(100), '██████')
  assert.equal(meterText(140), '██████')
  for (const p of [0, 2, 17, 33, 62.4, 82, 99, 100]) assert.equal([...meterText(p)].length, 6)
})

test('status cells: one per meter with its level, a countdown from 80%, meters optional', () => {
  const near: Snapshot = { ...SNAPSHOT, windows: [{ ...SNAPSHOT.windows[0], percentUsed: 82 }, SNAPSHOT.windows[1]] }
  const cells = statusCells(near, NOW, { showContext: true, showBars: true, show: 'all' })
  assert.deepEqual(
    cells.map(c => [c.key, c.text, c.level]),
    [
      ['five_hour', '5H ████▉░ 82% · 2h 14m', 'error'],
      ['seven_day', 'WK █▉░░░░ 31%', 'ok'],
      ['context', 'CTX █▎░░░░ 21%', 'ok'],
    ],
  )
  assert.deepEqual(
    statusCells(near, NOW, { showContext: true, showBars: false, show: 'all' }).map(c => c.text),
    ['5H 82% · 2h 14m', 'WK 31%', 'CTX 21%'],
  )
  // Alerts only: the meters from 50% up.
  assert.deepEqual(
    statusCells(SNAPSHOT, NOW, { showContext: true, showBars: true, show: 'alerts' }).map(c => c.key),
    ['five_hour'],
  )
  assert.deepEqual(statusCells(SNAPSHOT, NOW, { showContext: false, showBars: false, show: 'all' }).map(c => c.key), [
    'five_hour',
    'seven_day',
  ])
})
