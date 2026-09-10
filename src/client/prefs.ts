/**
 * Palette preferences: browser-local persistence for pinned/hidden entries,
 * recently-used order, the palette-open hotkey, and per-command direct
 * shortcut overrides. Whole-value JSON under one localStorage key; older
 * values without `bindings` migrate in place by taking the empty default, and
 * values written before the rename are read from their original key.
 */
import type { PaletteEntry, PalettePrefs } from './contract.ts'
import { DEFAULT_HOTKEY, type Hotkey } from './hotkey.ts'

const STORAGE_KEY = 'dsh-palette.prefs.v1'
/** Key used before the package rename; read-only fallback so saved settings survive. */
const LEGACY_STORAGE_KEY = 'dsh-command-palette.prefs.v1'
const RECENT_LIMIT = 5

/** Preference defaults: nothing pinned/hidden/recent; all shortcut defaults apply. */
export const DEFAULT_PREFS: PalettePrefs = {
  pinned: [],
  hidden: [],
  recent: [],
  hotkey: null,
  bindings: {},
}

/** Narrow an unknown persisted value to one normalized Hotkey. */
function hotkeyOf(value: unknown): Hotkey | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const h = value as Record<string, unknown>
  if (typeof h.mod !== 'boolean'
    || typeof h.ctrl !== 'boolean'
    || typeof h.alt !== 'boolean'
    || typeof h.shift !== 'boolean'
    || typeof h.key !== 'string') return undefined
  return { mod: h.mod, ctrl: h.ctrl, alt: h.alt, shift: h.shift, key: h.key }
}

/** Narrow an unknown persisted value to prefs; invalid members fall to defaults. */
function coercePrefs(value: unknown): PalettePrefs {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFS
  const v = value as Record<string, unknown>
  const idList = (key: string): readonly string[] =>
    Array.isArray(v[key]) && v[key]!.every((x): x is string => typeof x === 'string')
      ? v[key] as readonly string[]
      : []
  const hotkey = hotkeyOf(v.hotkey) ?? null
  const bindings: Record<string, Hotkey | null> = {}
  if (typeof v.bindings === 'object' && v.bindings !== null) {
    for (const [id, candidate] of Object.entries(v.bindings as Record<string, unknown>)) {
      if (candidate === null) bindings[id] = null
      else {
        const parsed = hotkeyOf(candidate)
        if (parsed !== undefined) bindings[id] = parsed
      }
    }
  }
  return {
    pinned: idList('pinned'),
    hidden: idList('hidden'),
    recent: idList('recent'),
    hotkey,
    bindings,
  }
}

/** Load persisted preferences (defaults when absent or unreadable). */
export function loadPrefs(): PalettePrefs {
  try {
    // Fall back to the pre-rename key so an existing setup keeps its
    // customized shortcuts; the next save writes the current key.
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    return raw === null ? DEFAULT_PREFS : coercePrefs(JSON.parse(raw))
  } catch {
    // Unreadable storage (quota/private mode) behaves as absent: defaults.
    return DEFAULT_PREFS
  }
}

/** Persist preferences; storage failures are non-fatal. */
export function savePrefs(prefs: PalettePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Same non-fatal contract as loadPrefs.
  }
}

/** The effective palette-open hotkey: the customized one or platform default. */
export function effectiveHotkey(prefs: PalettePrefs): Hotkey {
  return prefs.hotkey ?? DEFAULT_HOTKEY
}

/** Effective direct shortcut: explicit override/disable, else entry default. */
export function effectiveEntryHotkey(prefs: PalettePrefs, entry: PaletteEntry): Hotkey | null {
  if (Object.prototype.hasOwnProperty.call(prefs.bindings, entry.id)) {
    return prefs.bindings[entry.id] ?? null
  }
  return entry.defaultHotkey ?? null
}

/** Replace or disable one direct shortcut override. */
export function setEntryHotkey(prefs: PalettePrefs, id: string, hotkey: Hotkey | null): PalettePrefs {
  return { ...prefs, bindings: { ...prefs.bindings, [id]: hotkey } }
}

/** Move one id to the front of the recent list, capped at the limit. */
export function pushRecent(prefs: PalettePrefs, id: string): readonly string[] {
  return [id, ...prefs.recent.filter((x) => x !== id)].slice(0, RECENT_LIMIT)
}
