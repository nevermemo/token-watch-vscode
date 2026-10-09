// The snapshot the Token Watch mod writes (schema 1): its shape, where it
// is, how it is parsed, and when it counts as stale. Pure: no VS Code API,
// so node:test covers it.

import * as os from 'node:os'
import * as path from 'node:path'

export type SnapshotWindow = {
  kind: string
  label: string
  percentUsed: number
  resetsAt: string | null
}

export type SnapshotCategory = {
  label: string
  tokens: number
  color: string
  kind: 'used' | 'free' | 'buffer'
}

export type SnapshotContext = {
  total: number
  window: number
  percent: number
  compactsAt: number | null
  categories: SnapshotCategory[]
}

export type Snapshot = {
  schema: 1
  writtenAt: string
  session: { id: string | null; cwd: string | null }
  windows: SnapshotWindow[]
  context: SnapshotContext | null
}

// Where the mod writes, under the home directory.
export const DEFAULT_RELATIVE_PATH = path.join('.claude', 'token-watch', 'usage.json')

// The mod writes the snapshot again every 30 seconds while its session is
// alive; one older than this was left by a session that has ended.
export const STALE_MS = 150_000

// The snapshot's path: the setting, `~` expanded, or the default under `home`.
export function resolveSnapshotPath(setting: string | undefined, home = os.homedir()): string {
  const given = (setting ?? '').trim()
  if (given === '') return path.join(home, DEFAULT_RELATIVE_PATH)
  if (given === '~' || given.startsWith('~/') || given.startsWith('~\\')) return path.join(home, given.slice(1))
  return path.resolve(given)
}

// The file's text as a snapshot, or null when it is not a schema-1 snapshot
// (another schema, junk, or a torn read while the mod was writing).
export function parseSnapshot(text: string): Snapshot | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(raw) || raw.schema !== 1 || typeof raw.writtenAt !== 'string') return null
  const session = isRecord(raw.session) ? raw.session : {}
  const windows = Array.isArray(raw.windows) ? raw.windows.filter(isWindow) : []
  return {
    schema: 1,
    writtenAt: raw.writtenAt,
    session: { id: stringOrNull(session.id), cwd: stringOrNull(session.cwd) },
    windows: windows.map(w => ({ kind: w.kind, label: w.label, percentUsed: w.percentUsed, resetsAt: w.resetsAt ?? null })),
    context: isContext(raw.context) ? raw.context : null,
  }
}

// Whether the snapshot is too old to come from a live session.
export function isStale(snapshot: Snapshot, nowMs: number, staleMs = STALE_MS): boolean {
  const written = Date.parse(snapshot.writtenAt)
  return Number.isNaN(written) || nowMs - written > staleMs
}

// A window as it stands now: one whose reset time has passed has started
// over, so it reads 0% with no countdown, as the mod draws it.
export function current(window: SnapshotWindow, nowMs: number): SnapshotWindow {
  if (window.resetsAt === null) return window
  const resets = Date.parse(window.resetsAt)
  return Number.isNaN(resets) || resets > nowMs ? window : { ...window, percentUsed: 0, resetsAt: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isWindow(value: unknown): value is SnapshotWindow {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    typeof value.label === 'string' &&
    typeof value.percentUsed === 'number' &&
    (typeof value.resetsAt === 'string' || value.resetsAt === null || value.resetsAt === undefined)
  )
}

function isCategory(value: unknown): value is SnapshotCategory {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.tokens === 'number' &&
    typeof value.color === 'string' &&
    (value.kind === 'used' || value.kind === 'free' || value.kind === 'buffer')
  )
}

function isContext(value: unknown): value is SnapshotContext {
  return (
    isRecord(value) &&
    typeof value.total === 'number' &&
    typeof value.window === 'number' &&
    value.window > 0 &&
    typeof value.percent === 'number' &&
    (typeof value.compactsAt === 'number' || value.compactsAt === null) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategory)
  )
}
