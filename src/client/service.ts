/**
 * `ctx.commandPalette` runtime: the quick-entry registry plus the
 * recording-request bridge the palette view installs. Registered as a cordis
 * service through `ctx.reflect.provide` inside the plugin's effect, so the
 * service leaves with the fiber.
 */
import type { PaletteEntry, PaletteRuntimeFace } from './contract.ts'

/** Callback fired when the user asked (through an entry) to re-record the hotkey. */
export type RecordingRequest = () => void

/** The runtime's full face: the public registry plus view-internal wiring. */
export interface PaletteRuntime extends PaletteRuntimeFace {
  /** Live entries in registration order. */
  entries(): readonly PaletteEntry[]
  /** Recently active conversations pinned above the empty-query list. */
  recentSessions(): readonly PaletteEntry[]
  /** Install (or clear) the recent-conversations supplier. */
  setRecentSessions(fn: (() => readonly PaletteEntry[]) | null): void
  /** Optional-integration entries probed at each palette open. */
  dynamicEntries(): readonly PaletteEntry[]
  /** Install (or clear) the optional-integration supplier. */
  setDynamicEntries(fn: (() => readonly PaletteEntry[]) | null): void
  /** Install the view's recording listener (the view owns the actual capture). */
  onRecordingRequest(cb: RecordingRequest | null): void
  /** Fire the installed recording listener (no-op when the palette is closed). */
  beginHotkeyRecording(): void
}

/** Live mutable state behind the runtime face. */
interface Live {
  readonly registry: Map<string, PaletteEntry>
  recentSessions: (() => readonly PaletteEntry[]) | null
  dynamicEntries: (() => readonly PaletteEntry[]) | null
  recordingRequest: RecordingRequest | null
}

/**
 * Create the palette runtime.
 * @param provide - cordis `ctx.reflect.provide` bound to the plugin context.
 * @param effect - registers the service-disposal effect.
 * @returns the runtime, already provided as `commandPalette`.
 */
export function createPaletteRuntime(
  provide: (name: string, value: unknown) => () => void,
  effect: (register: () => () => void) => void,
): PaletteRuntime {
  const live: Live = { registry: new Map(), recentSessions: null, dynamicEntries: null, recordingRequest: null }
  const runtime: PaletteRuntime = {
    register(entry) {
      if (live.registry.has(entry.id)) throw new Error(`command palette: duplicate entry id "${entry.id}"`)
      live.registry.set(entry.id, entry)
      return () => {
        live.registry.delete(entry.id)
      }
    },
    entries: () => [...live.registry.values()],
    recentSessions: () => live.recentSessions?.() ?? [],
    setRecentSessions(fn) {
      live.recentSessions = fn
    },
    dynamicEntries: () => live.dynamicEntries?.() ?? [],
    setDynamicEntries(fn) {
      live.dynamicEntries = fn
    },
    onRecordingRequest(cb) {
      live.recordingRequest = cb
    },
    beginHotkeyRecording() {
      live.recordingRequest?.()
    },
  }
  effect(() => provide('commandPalette', runtime))
  return runtime
}
