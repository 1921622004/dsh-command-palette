/** stepSession: blank rows never become step targets; unresolved current is a no-op. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionRow, SessionsFace, WorkspaceUiFace } from '../src/client/deps.ts'
import { stepSession } from '../src/client/builtin.ts'

/** Minimal list builder: ids with blank flags; `current` owns the mainView count. */
function face(
  rows: readonly { id: string, blank?: boolean }[],
  initialCurrent?: string,
): { sessions: SessionsFace, ui: WorkspaceUiFace, opened: string[], setCurrent(id: string): void } {
  const ids = rows.map(row => row.id)
  const byId = Object.fromEntries(rows.map(row => [
    row.id,
    {
      id: row.id,
      displayTitle: row.id,
      running: false,
      ...(row.blank === undefined ? {} : { blank: row.blank }),
    } satisfies SessionRow,
  ])) as Record<string, SessionRow | undefined>
  let current = initialCurrent
  const opened: string[] = []
  const sessions = {
    list: {
      getSnapshot: () => ({
        ids,
        // Mirror the real store: the main view's retention follows the last opened row.
        byId: Object.fromEntries(ids.map(id => [
          id,
          { ...byId[id], retainedBy: id === current ? { mainView: 1 } : {} },
        ])),
      }),
    },
  } as unknown as SessionsFace
  const ui = {
    openSession: (id: string) => {
      opened.push(id)
      current = id
    },
  } as WorkspaceUiFace
  return { sessions, ui, opened, setCurrent: (id: string) => { current = id } }
}

const LIST = [
  { id: 'newest' },
  { id: 'blank-1', blank: true },
  { id: 'middle' },
  { id: 'oldest' },
]

test('stepping skips reusable blank rows', () => {
  const withMain = face(LIST, 'newest')
  stepSession(withMain.ui, withMain.sessions, 1)
  assert.deepEqual(withMain.opened, ['middle'])
})

test('stepping backwards walks real conversations only', () => {
  const env = face(LIST, 'oldest')
  // current = oldest: prev lands on middle (blank-1 skipped).
  stepSession(env.ui, env.sessions, -1)
  assert.deepEqual(env.opened, ['middle'])
  stepSession(env.ui, env.sessions, -1)
  assert.deepEqual(env.opened, ['middle', 'newest'])
})

test('unresolved current session steps nowhere instead of guessing ids[0]', () => {
  const env = face(LIST) // no mainView anywhere: mid-switch retention lag
  stepSession(env.ui, env.sessions, 1)
  stepSession(env.ui, env.sessions, -1)
  assert.deepEqual(env.opened, [])
})

test('stepping past the ends is a no-op', () => {
  const env = face(LIST, 'newest')
  stepSession(env.ui, env.sessions, -1)
  assert.deepEqual(env.opened, [])
  const tail = face(LIST, 'oldest')
  stepSession(tail.ui, tail.sessions, 1)
  assert.deepEqual(tail.opened, [])
})
