import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaletteRuntime } from '../src/client/service.ts'

test('beginRename forwards the payload to the installed listener', () => {
  const runtime = createPaletteRuntime(() => () => {}, () => {})
  const seen: string[] = []
  runtime.onRenameRequest(request => { seen.push(request.sessionId) })
  runtime.beginRename({ sessionId: 's1', original: 'Old title', confirm: async () => {} })
  assert.deepEqual(seen, ['s1'])
})

test('clearing the listener stops rename delivery', () => {
  const runtime = createPaletteRuntime(() => () => {}, () => {})
  const seen: string[] = []
  runtime.onRenameRequest(() => { seen.push('x') })
  runtime.onRenameRequest(null)
  runtime.beginRename({ sessionId: 's2', original: 'Old title', confirm: async () => {} })
  assert.deepEqual(seen, [])
})
