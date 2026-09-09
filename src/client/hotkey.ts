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

/** Build one platform-primary shortcut (Mod = macOS ⌘, Windows/Linux Ctrl). */
export function modHotkey(
  key: string,
  options: { readonly alt?: boolean, readonly shift?: boolean } = {},
): Hotkey {
  return {
    mod: true,
    ctrl: false,
    alt: options.alt ?? false,
    shift: options.shift ?? false,
    key,
  }
}

/** The default palette hotkey: ⌘K on macOS, Ctrl+K elsewhere. */
export const DEFAULT_HOTKEY: Hotkey = modHotkey('k')

/** True on Apple platforms (navigator-based; jsdom reports MacIntel by default). */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
}

/** Structural pick of KeyboardEvent the hotkey logic reads. */
export interface HotkeyEvent {
  readonly key: string
  /** Physical key identity; used to recover the base key under Alt/Option. */
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

/** Base shortcut key recovered from KeyboardEvent.code where possible. */
function baseKey(event: HotkeyEvent): string {
  const code = event.code
  if (code !== undefined) {
    if (/^Key[A-Z]$/u.test(code)) return code.slice(3).toLowerCase()
    if (/^Digit[0-9]$/u.test(code)) return code.slice(5)
    const punctuation: Readonly<Record<string, string>> = {
      Comma: ',',
      Period: '.',
      Slash: '/',
      Semicolon: ';',
      Quote: "'",
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Minus: '-',
      Equal: '=',
      Backquote: '`',
    }
    const normalized = punctuation[code]
    if (normalized !== undefined) return normalized
  }
  return event.key.length === 1 ? event.key.toLowerCase() : event.key
}

/**
 * Normalize a key press into a Hotkey. The press's platform primary
 * modifier (Meta on macOS, Ctrl elsewhere) is canonicalized into `mod`.
 * KeyboardEvent.code recovers the base letter/punctuation under macOS
 * Option (for example ⌘⌥A reports the physical A rather than “å”).
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
    key: baseKey(event),
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
    && baseKey(event).toLowerCase() === canonical.key.toLowerCase()
}

/** Whether two combinations resolve to the same platform-normalized chord. */
export function sameHotkey(left: Hotkey, right: Hotkey): boolean {
  const a = canonicalize(left)
  const b = canonicalize(right)
  return a.mod === b.mod
    && a.ctrl === b.ctrl
    && a.alt === b.alt
    && a.shift === b.shift
    && a.key.toLowerCase() === b.key.toLowerCase()
}

/** Whether a chord is safe as a global shortcut (modifier or function key required). */
export function isGlobalHotkey(hotkey: Hotkey): boolean {
  const key = hotkey.key.toUpperCase()
  return hotkey.mod || hotkey.ctrl || hotkey.alt || /^F(?:[1-9]|1[0-2])$/u.test(key)
}

/** Human-readable form, e.g. "⌘K" / "Ctrl+Shift+P". */
export function formatHotkey(hotkey: Hotkey): string {
  const canonical = canonicalize(hotkey)
  const mac = isMac()
  const key = ({
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
  } as Readonly<Record<string, string>>)[canonical.key.toLowerCase()] ?? canonical.key.toUpperCase()
  if (mac) {
    const parts: string[] = []
    if (canonical.mod) parts.push('⌘')
    if (canonical.ctrl) parts.push('Ctrl')
    if (canonical.alt) parts.push('⌥')
    if (canonical.shift) parts.push('⇧')
    return parts.join('') + key
  }
  const parts: string[] = []
  if (canonical.mod) parts.push('Ctrl')
  if (canonical.alt) parts.push('Alt')
  if (canonical.shift) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}
