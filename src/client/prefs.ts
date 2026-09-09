/**
 * Palette preferences: browser-local persistence (pinned/hidden entries,
 * recently-used order, customized open hotkey). Whole-value JSON under one
 * localStorage key; corrupt or absent storage resets to defaults.
 */
import type { PalettePrefs } from './contract.ts'
import { DEFAULT_HOTKEY, type Hotkey } from './hotkey.ts'

const STORAGE_KEY = 'dsh-command-palette.prefs.v1'
const RECENT_LIMIT = 5

/** Preference defaults: nothing pinned/hidden/recent, platform-default hotkey. */
export const DEFAULT_PREFS: PalettePrefs = { pinned: [], hidden: [], recent: [], hotkey: null }

/** Narrow an unknown persisted value to prefs; invalid members fall to defaults. */
function coercePrefs(value: unknown): PalettePrefs {
  if (typeof value !== 'object' || value === null) return DEFAULT_PREFS
  const v = value as Record<string, unknown>
  const idList = (key: string): readonly string[] =>
    Array.isArray(v[key]) && v[key]!.every((x): x is string => typeof x === 'string') ? v[key] as readonly string[] : []
  const h = v.hotkey
  const hotkey: Hotkey | null = typeof h === 'object' && h !== null
    && typeof (h as Record<string, unknown>).mod === 'boolean'
    && typeof (h as Record<string, unknown>).ctrl === 'boolean'
    && typeof (h as Record<string, unknown>).alt === 'boolean'
    && typeof (h as Record<string, unknown>).shift === 'boolean'
    && typeof (h as Record<string, unknown>).key === 'string'
      ? h as unknown as Hotkey
      : null
  return { pinned: idList('pinned'), hidden: idList('hidden'), recent: idList('recent'), hotkey }
}

/** Load persisted preferences (defaults when absent or unreadable). */
export function loadPrefs(): PalettePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

/** The effective open hotkey: the customized one or the platform default. */
export function effectiveHotkey(prefs: PalettePrefs): Hotkey {
  return prefs.hotkey ?? DEFAULT_HOTKEY
}

/** Move one id to the front of the recent list, capped at the limit. */
export function pushRecent(prefs: PalettePrefs, id: string): readonly string[] {
  return [id, ...prefs.recent.filter((x) => x !== id)].slice(0, RECENT_LIMIT)
}
