import test from 'node:test'
import assert from 'node:assert/strict'
import { createPetProbe } from '../src/client/optional-integrations.ts'

interface Recorded { path: string, body?: unknown }

/** Install a fetch stub serving the pet API; returns recorded calls and a state setter. */
function installFetch(state: { visible: boolean } | null, fail = false): {
  calls: Recorded[]
  setVisible: (visible: boolean) => void
} {
  const calls: Recorded[] = []
  const current = { state }
  ;(globalThis as { fetch?: unknown }).fetch = (async (path: string, init?: { method?: string, body?: string }) => {
    calls.push({ path, body: init?.body === undefined ? undefined : JSON.parse(init.body) })
    if (fail) return { ok: false, json: async () => ({}) }
    if (String(path).endsWith('/set-visible')) {
      const parsed = JSON.parse(init?.body ?? '{}') as { visible: boolean }
      if (current.state !== null) current.state.visible = parsed.visible
      return { ok: true, json: async () => ({ ok: true }) }
    }
    return {
      ok: current.state === null ? false : true,
      status: current.state === null ? 404 : 200,
      json: async () => ({ display: { visible: current.state?.visible ?? false } }),
    }
  }) as unknown
  return {
    calls,
    setVisible: visible => { if (current.state !== null) current.state.visible = visible },
  }
}

test('probe marks the pet alive and caches visibility from the state endpoint', async () => {
  const io = installFetch({ visible: true })
  const pet = createPetProbe()
  await pet.refresh()
  assert.equal(pet.alive(), true)
  assert.equal(pet.visible(), true)
  assert.equal(io.calls.some(c => c.path === '/api/pet/state'), true)
})

test('toggle flips the current visibility through set-visible', async () => {
  const io = installFetch({ visible: true })
  const pet = createPetProbe()
  await pet.refresh()
  await pet.toggle()
  const post = io.calls.find(c => c.path === '/api/pet/set-visible')
  assert.deepEqual(post?.body, { visible: false })
  assert.equal(pet.visible(), false)
})

test('a failed probe reports the pet as absent', async () => {
  installFetch(null, true)
  const pet = createPetProbe()
  await pet.refresh()
  assert.equal(pet.alive(), false)
})
