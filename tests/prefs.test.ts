import test from 'node:test'
import assert from 'node:assert/strict'

/** Install a localStorage stub backed by one map; returns the map for assertions. */
function installStorage(initial: Record<string, string>): Map<string, string> {
  const store = new Map(Object.entries(initial))
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
  return store
}

test('loads preferences persisted under the pre-rename storage key', async () => {
  const legacy = {
    pinned: ['palette.session.new'],
    hidden: [],
    recent: ['palette.settings.theme'],
    hotkey: { mod: true, ctrl: false, alt: false, shift: false, key: 'p' },
    bindings: { 'palette.session.archive': null },
  }
  const store = installStorage({ 'dsh-command-palette.prefs.v1': JSON.stringify(legacy) })
  const prefs = await import(`../src/client/prefs.ts?legacy=${String(Date.now())}`)
  const loaded = prefs.loadPrefs()
  assert.deepEqual(loaded.pinned, ['palette.session.new'])
  assert.deepEqual(loaded.recent, ['palette.settings.theme'])
  assert.equal(loaded.hotkey?.key, 'p')
  assert.equal(loaded.bindings['palette.session.archive'], null)
  assert.equal(store.has('dsh-command-palette.prefs.v1'), true)
})

test('prefers the current storage key when both are present', async () => {
  const current = { pinned: ['a'], hidden: [], recent: [], hotkey: null, bindings: {} }
  const legacy = { pinned: ['b'], hidden: [], recent: [], hotkey: null, bindings: {} }
  installStorage({
    'dsh-palette.prefs.v1': JSON.stringify(current),
    'dsh-command-palette.prefs.v1': JSON.stringify(legacy),
  })
  const prefs = await import(`../src/client/prefs.ts?both=${String(Date.now())}`)
  assert.deepEqual(prefs.loadPrefs().pinned, ['a'])
})

test('writes saves under the current storage key', async () => {
  const store = installStorage({})
  const prefs = await import(`../src/client/prefs.ts?write=${String(Date.now())}`)
  prefs.savePrefs({ pinned: ['x'], hidden: [], recent: [], hotkey: null, bindings: {} })
  assert.equal(store.has('dsh-palette.prefs.v1'), true)
  assert.deepEqual(JSON.parse(store.get('dsh-palette.prefs.v1') ?? '{}').pinned, ['x'])
})
