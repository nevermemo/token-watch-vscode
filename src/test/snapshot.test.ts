import assert from 'node:assert/strict'
import * as path from 'node:path'
import { test } from 'node:test'

import { current, isStale, parseSnapshot, resolveSnapshotPath, STALE_MS } from '../snapshot'

const NOW = Date.parse('2026-10-03T12:00:00Z')
const TEXT = JSON.stringify({
  schema: 1,
  writtenAt: '2026-10-03T12:00:00.000Z',
  session: { id: 'sess-1', cwd: 'C:/proj' },
  windows: [{ kind: 'five_hour', label: '5H', percentUsed: 62.4, resetsAt: '2026-10-03T14:14:00.000Z' }],
  context: {
    total: 212_200,
    window: 1_000_000,
    percent: 21,
    compactsAt: 950_000,
    categories: [{ label: 'messages', tokens: 186_000, color: '#d97757', kind: 'used' }],
  },
})

test('parses a schema-1 snapshot', () => {
  const s = parseSnapshot(TEXT)
  assert.ok(s)
  assert.equal(s.writtenAt, '2026-10-03T12:00:00.000Z')
  assert.deepEqual(s.session, { id: 'sess-1', cwd: 'C:/proj' })
  assert.equal(s.windows[0].label, '5H')
  assert.equal(s.context?.compactsAt, 950_000)
})

test('tolerates a missing session and context, and a window with no resetsAt', () => {
  const s = parseSnapshot(JSON.stringify({ schema: 1, writtenAt: 'x', windows: [{ kind: 'k', label: 'K', percentUsed: 5 }] }))
  assert.ok(s)
  assert.deepEqual(s.session, { id: null, cwd: null })
  assert.equal(s.context, null)
  assert.equal(s.windows[0].resetsAt, null)
})

test('rejects junk, a torn file and another schema', () => {
  assert.equal(parseSnapshot(''), null)
  assert.equal(parseSnapshot(TEXT.slice(0, 40)), null)
  assert.equal(parseSnapshot(JSON.stringify({ schema: 2, writtenAt: 'x' })), null)
  assert.equal(parseSnapshot('[]'), null)
})

test('stale once the mod has missed its 30-second rewrites', () => {
  const s = parseSnapshot(TEXT)
  assert.ok(s)
  assert.equal(isStale(s, NOW + 60_000), false)
  assert.equal(isStale(s, NOW + STALE_MS), false)
  assert.equal(isStale(s, NOW + STALE_MS + 1), true)
  assert.equal(isStale({ ...s, writtenAt: 'not a date' }, NOW), true)
})

test('an expired window reads 0% and loses its countdown', () => {
  const w = { kind: 'seven_day', label: 'WK', percentUsed: 90, resetsAt: '2026-10-03T11:59:00.000Z' }
  assert.deepEqual(current(w, NOW), { ...w, percentUsed: 0, resetsAt: null })
  const later = { ...w, resetsAt: '2026-10-03T12:01:00.000Z' }
  assert.deepEqual(current(later, NOW), later)
})

test('the snapshot path: the default under home, a ~ setting, an absolute setting', () => {
  const home = path.resolve('/home/test')
  const expected = path.join(home, '.claude', 'token-watch', 'usage.json')
  assert.equal(resolveSnapshotPath(undefined, home), expected)
  assert.equal(resolveSnapshotPath('  ', home), expected)
  assert.equal(resolveSnapshotPath('~/elsewhere/usage.json', home), path.join(home, 'elsewhere', 'usage.json'))
  const absolute = path.resolve('/tmp/usage.json')
  assert.equal(resolveSnapshotPath(absolute, home), absolute)
})
