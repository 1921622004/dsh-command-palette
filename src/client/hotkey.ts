/**
 * Palette open-hotkey parsing and matching. `mod` names the platform's
 * primary modifier — Meta on macOS, Ctrl elsewhere — so one persisted
 * combination describes the same gesture cross-platform.
 */

/** One normalized keyboard combination, e.g. Mod+K or Ctrl+Shift+P. */
export interface Hotkey {
  readonly mod: boolean
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  /** KeyboardEvent.key with single characters lowercased. */
  readonly key: string
}

/** The default palette hotkey: ⌘K on macOS, Ctrl+K elsewhere. */
export const DEFAULT_HOTKEY: Hotkey = { mod: true, ctrl: false, alt: false, shift: false, key: 'k' }

/** True on Apple platforms (navigator-based; jsdom reports MacIntel by default). */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
}

/** Structural pick of KeyboardEvent the hotkey logic reads. */
export interface HotkeyEvent {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/**
 * Normalize a key press into a Hotkey. The press's platform primary
 * modifier (Meta on macOS, Ctrl elsewhere) is canonicalized into `mod`, so
 * a recorded combination matches on the recording platform — a Windows
 * Ctrl+P records as Mod+P, never as a literal-Ctrl combination that
 * {@link matchesHotkey} would refuse.
 * @param event - the press to capture; bare modifier presses return null.
 */
export function eventToHotkey(event: HotkeyEvent): Hotkey | null {
  const { key } = event
  if (key === 'Meta' || key === 'Control' || key === 'Alt' || key === 'Shift') return null
  const mac = isMac()
  return {
    mod: mac ? event.metaKey : event.ctrlKey,
    ctrl: mac ? event.ctrlKey : false,
    alt: event.altKey,
    shift: event.shiftKey,
    key: key.length === 1 ? key.toLowerCase() : key,
  }
}

/** A legacy non-mac capture stored Ctrl as the literal component; fold it into `mod`. */
function canonicalize(hotkey: Hotkey): Hotkey {
  if (!isMac() && hotkey.ctrl && !hotkey.mod) return { ...hotkey, mod: true, ctrl: false }
  return hotkey
}

/**
 * Whether the press matches the hotkey. The platform's mod-key never also
 * counts as the literal Ctrl component.
 */
export function matchesHotkey(event: HotkeyEvent, hotkey: Hotkey): boolean {
  const canonical = canonicalize(hotkey)
  const mac = isMac()
  const modPressed = mac ? event.metaKey : event.ctrlKey
  const ctrlPressed = mac ? event.ctrlKey : false
  return modPressed === canonical.mod
    && ctrlPressed === canonical.ctrl
    && event.altKey === canonical.alt
    && event.shiftKey === canonical.shift
    && event.key.toLowerCase() === canonical.key
}

/** Human-readable form, e.g. "⌘K" / "Ctrl+Shift+P". */
export function formatHotkey(hotkey: Hotkey): string {
  const canonical = canonicalize(hotkey)
  const mac = isMac()
  const parts: string[] = []
  if (canonical.mod) parts.push(mac ? '⌘' : 'Ctrl')
  if (canonical.ctrl) parts.push(mac ? 'Ctrl' : '⌃')
  if (canonical.alt) parts.push(mac ? '⌥' : 'Alt')
  if (canonical.shift) parts.push(mac ? '⇧' : 'Shift')
  return parts.join('') + canonical.key.toUpperCase()
}
