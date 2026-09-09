/**
 * Optional dsh-better-sidebar integration. The plugin exposes the
 * `betterSidebar` cordis service (tab registry + `openTab`); panel
 * visibility is not service-addressable, so the expand step drives the
 * plugin's own DOM hooks: `body[data-dsh-sidebar-collapsed]` (fold state)
 * and `[data-dsh-toggle-cluster] button` (the right-panel toggle is the
 * cluster's last button). Entries register only while the service is up
 * (reactive `ctx.inject`), so uninstalling the plugin removes them.
 */
import type { PaletteRuntime } from './service.ts'
import { modHotkey } from './hotkey.ts'

/** The `betterSidebar` service face these entries consume. */
export interface BetterSidebarFace {
  /** Whether a tab type is enabled in the side card prefs. */
  isTabEnabled(id: string): boolean
  /** Open (create or focus) one tab by type; a disabled type is a no-op. */
  openTab(seed: { readonly type: string, readonly title?: string }): void
}

/**
 * Expand the right panel when folded; no-op when already open.
 */
function ensureSidebarPanelOpen(): void {
  if (!document.body.hasAttribute('data-dsh-sidebar-collapsed')) return
  const buttons = document.querySelectorAll('[data-dsh-toggle-cluster] button')
  const toggle = buttons[buttons.length - 1]
  if (toggle instanceof HTMLButtonElement) toggle.click()
}

/**
 * Register the better-sidebar entries on the runtime.
 * @param runtime - the palette runtime.
 * @param sidebar - the live `betterSidebar` service face.
 * @returns the aggregate disposer.
 */
export function registerBetterSidebarEntries(runtime: PaletteRuntime, sidebar: BetterSidebarFace): () => void {
  const disposers = [
    runtime.register({
      id: 'palette.sidebar.open',
      group: 'extension',
      labelKey: 'entry.sidebar.open',
      detailKey: 'entry.sidebar.open.detail',
      keywords: ['sidebar', 'panel'],
      defaultHotkey: modHotkey('j'),
      execute: () => ensureSidebarPanelOpen(),
    }),
    runtime.register({
      id: 'palette.sidebar.terminal',
      group: 'extension',
      labelKey: 'entry.sidebar.terminal',
      detailKey: 'entry.sidebar.terminal.detail',
      keywords: ['terminal', 'shell', 'pty'],
      defaultHotkey: modHotkey('j', { shift: true }),
      execute: () => {
        if (sidebar.isTabEnabled('terminal') === false) return
        ensureSidebarPanelOpen()
        sidebar.openTab({ type: 'terminal' })
      },
    }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}
