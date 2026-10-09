import assert from 'node:assert/strict'
import { test } from 'node:test'

import { age, countdown, level, panelModel, RESERVE, short, statusText, tooltipMarkdown, TRACK, worstLevel } from '../format'
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
  assert.equal(statusText(extra, NOW, true), '5H 62% · WK 31% · FB 88% · mystery_window 5% · CTX 21%')
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

test('tooltip: each window with its countdown, the context, the legend largest first, the age', () => {
  const md = tooltipMarkdown(SNAPSHOT, NOW)
  assert.match(md, /\*\*5H\*\* 62% · resets in 2h 14m/)
  assert.match(md, /\*\*WK\*\* 31% · resets in 3d 4h/)
  assert.match(md, /\*\*CTX\*\* 21% · 212k of 1M · auto-compacts at 950k/)
  assert.match(md, /messages 186k · tools 12k · system 3\.4k/)
  assert.match(md, /snapshot 12s ago/)
  assert.doesNotMatch(md, /free/)
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
