/**
 * Business contract of the palette surface: what an entry looks like and
 * the `ctx.commandPalette.register` face other plugins consume.
 */
import type { PaletteKey } from './locales.ts'
import type { Hotkey } from './hotkey.ts'

/** Entry group; rendering order follows this union's declaration order. */
export type PaletteGroupId = 'session' | 'settings' | 'action' | 'extension'

/** One option of an entry's second-level choice list. */
export interface PaletteChoice {
  readonly id: string
  /** Display label (already localized by the registrant). */
  readonly label: string
  /**
   * Short trailing chip after the label (data literal, same rule as the
   * label): e.g. the workspace title on a session choice; participates in
   * keyword matching.
   */
  readonly tag?: string
  readonly detail?: string
  /** Keep the palette open after this choice runs (used by shortcut recording). */
  readonly keepOpen?: boolean
  execute(): void | Promise<void>
}

/** One quick-entry contribution. */
export interface PaletteEntry {
  /** Unique id across contributions; a collision fails loud at registration. */
  readonly id: string
  readonly group: PaletteGroupId
  /** Built-in label: a `palette`-namespace dictionary key. */
  readonly labelKey?: PaletteKey
  /** Extension label: a literal, already-localized string. */
  readonly label?: string
  /**
   * Short trailing chip after the label (data literal, same rule as the
   * label): e.g. the workspace title on a recent-session row. Absent on
   * entries with no such fact; it participates in keyword matching.
   */
  readonly tag?: string
  /** Optional detail line (same key/literal rule as the label). */
  readonly detailKey?: PaletteKey
  readonly detail?: string
  /** Extra match keywords beyond label/detail. */
  readonly keywords?: readonly string[]
  /** Default direct-execution shortcut; user preferences may replace or disable it. */
  readonly defaultHotkey?: Hotkey
  /**
   * Second-level selector: a non-empty list opens the sub-level view; null
   * falls through to `execute`.
   */
  readonly choices?: () => readonly PaletteChoice[] | null
  /** Keep the palette open after direct execution (used by shortcut recording). */
  readonly keepOpen?: boolean
  /** The entry's action; required exactly when `choices` is absent. */
  execute?(): void | Promise<void>
}

/** The `ctx.commandPalette` service face. */
export interface PaletteRuntimeFace {
  /**
   * Register one quick entry; returns the disposer. Duplicate ids throw.
   */
  register(entry: PaletteEntry): () => void
}

/** Per-user palette preferences (persisted browser-locally). */
export interface PalettePrefs {
  readonly pinned: readonly string[]
  readonly hidden: readonly string[]
  readonly recent: readonly string[]
  /** User-customized palette-open hotkey; null keeps the platform default (⌘K / Ctrl+K). */
  readonly hotkey: Hotkey | null
  /** Per-entry overrides: absent = entry default, Hotkey = override, null = disabled. */
  readonly bindings: Readonly<Record<string, Hotkey | null>>
}
