/**
 * Optional dsh-better-sidebar integration. The plugin exposes the
 * `betterSidebar` service for tab types and `openTab`; current versions also
 * cooperate with DSH's native `sidebarRight` face. Tab opens prefer the
 * native face and fall back to the older DOM panel toggle. Entries register
 * only while the better-sidebar service is up.
 */
import type { PaletteRuntime } from './service.ts'
import { modHotkey } from './hotkey.ts'
import { prepareTerminalOpen, type OfficialSidebarFace } from './sidebar-compat.ts'

/** The `betterSidebar` service face these entries consume. */
export interface BetterSidebarFace {
  /** Whether a tab type is enabled in the side card prefs. */
  isTabEnabled(id: string): boolean
  /** Open (create or focus) one tab by type; a disabled type is a no-op. */
  openTab(seed: { readonly type: string, readonly title?: string }): void
}

/** Return the legacy open-only callback, when the old DOM surface is present and folded. */
function legacySidebarOpenClick(): (() => void) | undefined {
  if (!document.body.hasAttribute('data-dsh-sidebar-collapsed')) return undefined
  const buttons = document.querySelectorAll('[data-dsh-toggle-cluster] button')
  const toggle = buttons[buttons.length - 1]
  return toggle instanceof HTMLButtonElement ? () => { toggle.click() } : undefined
}

/**
 * Register the better-sidebar entries on the runtime. The panel toggle
 * lives in optional-integrations (a true switch with a state-following
 * label); this module keeps the entries that need the service's openTab
 * face: files, file changes, and terminal.
 * @param runtime - the palette runtime.
 * @param sidebar - the live `betterSidebar` service face.
 * @param officialSidebar - current official right-Sidebar face, when supplied.
 * @returns the aggregate disposer.
 */
export function registerBetterSidebarEntries(
  runtime: PaletteRuntime,
  sidebar: BetterSidebarFace,
  officialSidebar: () => OfficialSidebarFace | undefined = () => undefined,
): () => void {
  /** Open one tab type, revealing the surface it lands in. */
  const open = (type: string): void => {
    if (sidebar.isTabEnabled(type) === false) return
    const official = officialSidebar()
    prepareTerminalOpen(official, official === undefined ? legacySidebarOpenClick() : undefined)
    sidebar.openTab({ type })
  }
  const disposers = [
    runtime.register({
      id: 'palette.sidebar.files',
      group: 'sidebar',
      labelKey: 'entry.sidebar.files',
      detailKey: 'entry.sidebar.files.detail',
      keywords: ['files', 'explorer', 'editor'],
      execute: () => open('editor'),
    }),
    runtime.register({
      id: 'palette.sidebar.changes',
      group: 'sidebar',
      labelKey: 'entry.sidebar.changes',
      keywords: ['changes', 'git', 'diff'],
      execute: () => open('git'),
    }),
    runtime.register({
      id: 'palette.sidebar.terminal',
      group: 'sidebar',
      labelKey: 'entry.sidebar.terminal',
      detailKey: 'entry.sidebar.terminal.detail',
      keywords: ['terminal', 'shell', 'pty'],
      defaultHotkey: modHotkey('j', { shift: true }),
      execute: () => open('terminal'),
    }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}
