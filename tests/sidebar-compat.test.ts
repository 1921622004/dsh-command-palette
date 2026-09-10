import test from 'node:test'
import assert from 'node:assert/strict'
import {
  prepareTerminalOpen,
  sidebarLabelKey,
  toggleSidebar,
  type OfficialSidebarFace,
} from '../src/client/sidebar-compat.ts'

function official(expanded: boolean): OfficialSidebarFace & { toggles: number } {
  return {
    expanded,
    toggles: 0,
    isExpanded() { return this.expanded },
    toggleExpanded() { this.toggles += 1; this.expanded = !this.expanded },
  }
}

test('uses the official sidebar face for toggle commands even when expanded', () => {
  const face = official(true)
  let legacyClicks = 0
  const result = toggleSidebar(face, () => { legacyClicks += 1 })
  assert.equal(result, 'official')
  assert.equal(face.toggles, 1)
  assert.equal(legacyClicks, 0)
})

test('falls back to the legacy toggle when the official face is absent', () => {
  let clicks = 0
  const result = toggleSidebar(undefined, () => { clicks += 1 })
  assert.equal(result, 'legacy')
  assert.equal(clicks, 1)
})

test('does nothing when neither sidebar integration is available', () => {
  assert.equal(toggleSidebar(undefined, undefined), 'none')
})

test('leaves native expansion to better-sidebar openTab when the official face exists', () => {
  const collapsed = official(false)
  let legacyClicks = 0
  assert.equal(prepareTerminalOpen(collapsed, () => { legacyClicks += 1 }), 'official-managed')
  assert.equal(collapsed.toggles, 0)
  assert.equal(legacyClicks, 0)
})

test('uses the legacy open fallback when the official face is absent', () => {
  let clicks = 0
  assert.equal(prepareTerminalOpen(undefined, () => { clicks += 1 }), 'legacy')
  assert.equal(clicks, 1)
})

test('label follows the official expanded state', () => {
  assert.equal(sidebarLabelKey(false), 'entry.sidebar.open')
  assert.equal(sidebarLabelKey(true), 'entry.sidebar.close')
})
