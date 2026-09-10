/**
 * Compatibility helpers for DSH's official right Sidebar and the older
 * dsh-better-sidebar DOM surface. The official service wins whenever it is
 * available; the DOM callback is retained for older compositions.
 */

/** Minimal official right-Sidebar face used by the palette. */
export interface OfficialSidebarFace {
  isExpanded(): boolean
  toggleExpanded(): void
}

/** Result of choosing the sidebar integration. */
export type SidebarActionResult = 'official' | 'official-managed' | 'legacy' | 'none'

/** Label key selected from the official or legacy fold state. */
export function sidebarLabelKey(expanded: boolean): 'entry.sidebar.open' | 'entry.sidebar.close' {
  return expanded ? 'entry.sidebar.close' : 'entry.sidebar.open'
}

/** Toggle the sidebar, preferring the official service. */
export function toggleSidebar(
  official: OfficialSidebarFace | undefined,
  legacyClick: (() => void) | undefined,
): SidebarActionResult {
  if (official !== undefined) {
    official.toggleExpanded()
    return 'official'
  }
  if (legacyClick !== undefined) {
    legacyClick()
    return 'legacy'
  }
  return 'none'
}

/**
 * Prepare a terminal open. Current better-sidebar versions own native panel
 * expansion inside `openTab`; only legacy versions need an explicit DOM open.
 */
export function prepareTerminalOpen(
  official: OfficialSidebarFace | undefined,
  legacyClick: (() => void) | undefined,
): SidebarActionResult {
  if (official !== undefined) return 'official-managed'
  if (legacyClick !== undefined) {
    legacyClick()
    return 'legacy'
  }
  return 'none'
}
