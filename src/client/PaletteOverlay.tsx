/**
 * The palette overlay: the shell.overlay entry that renders the keyboard
 * command popup. Component state owns open/query/highlight/sub-level and
 * shortcut recording; the entry registry and copy arrive through injected
 * faces. One row sequence drives both rendering and keyboard navigation.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import type { PaletteChoice, PaletteEntry, PalettePrefs } from './contract.ts'
import type { PaletteKey } from './locales.ts'
import type { PaletteRuntime } from './service.ts'
import { rankItems } from './fuzzy.ts'
import {
  eventToHotkey, formatHotkey, isGlobalHotkey, matchesHotkey, sameHotkey, type Hotkey,
} from './hotkey.ts'
import {
  effectiveEntryHotkey, effectiveHotkey, loadPrefs, pushRecent, savePrefs, setEntryHotkey,
} from './prefs.ts'

/** Group order for rendering. */
const GROUP_ORDER: readonly PaletteEntry['group'][] = ['session', 'settings', 'action', 'extension']

const GROUP_KEY: Record<PaletteEntry['group'], PaletteKey> = {
  session: 'group.session',
  settings: 'group.settings',
  action: 'group.action',
  extension: 'group.extension',
}

/** Injected face of the overlay entry: the runtime plus the copy seat. */
export interface PaletteOverlayProps {
  readonly palette: PaletteRuntime
  readonly t: (key: PaletteKey, params?: Record<string, unknown>) => string
}

/** One rendered row: a top-level entry or a sub-level choice. */
interface Row {
  readonly entry: PaletteEntry
  readonly choice?: PaletteChoice
}

/** Shortcut currently being recorded; absent entry id means palette-open. */
interface RecordingTarget {
  readonly entryId?: string
  readonly label: string
}

/** Resolve one entry's display label through the locale seat. */
function labelOf(t: PaletteOverlayProps['t'], key: PaletteKey | undefined, literal: string | undefined): string {
  return key !== undefined ? t(key) : literal ?? ''
}

/** Resolve one thrown value into the human-visible error line. */
function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

/**
 * Render the command palette while open; null while closed.
 * @param props - injected runtime face and locale seat.
 */
export function PaletteOverlay({ palette, t }: PaletteOverlayProps): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [sub, setSub] = useState<{ readonly entry: PaletteEntry; readonly choices: readonly PaletteChoice[] } | null>(null)
  const [recording, setRecording] = useState<RecordingTarget | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PalettePrefs>(() => loadPrefs())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hotkey = effectiveHotkey(prefs)
  // The global listener reads current state through one ref, so it need not
  // rebind for every key capture or preference update.
  const stateRef = useRef({ open, recording, hotkey, prefs })
  stateRef.current = { open, recording, hotkey, prefs }

  const updatePrefs = useCallback((next: PalettePrefs) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setSub(null)
    setQuery('')
    setError(null)
    setRecording(null)
  }, [])

  const openPalette = useCallback(() => {
    setOpen(true)
    setSub(null)
    setQuery('')
    setActive(0)
    setError(null)
    setRecording(null)
  }, [])

  /** Live registry snapshot, deduplicated by id (registered entries win). */
  const allEntries = useCallback((): readonly PaletteEntry[] => {
    const entries = new Map<string, PaletteEntry>()
    for (const entry of [...palette.dynamicEntries(), ...palette.entries()]) entries.set(entry.id, entry)
    return [...entries.values()]
  }, [palette])

  const showError = useCallback((reason: unknown) => {
    setOpen(true)
    setError(t('status.error', { message: errorText(reason) }))
  }, [t])

  /** Settle one action and record usage; keepOpen supports shortcut capture. */
  const execute = useCallback((
    entry: PaletteEntry,
    action: () => void | Promise<void>,
    keepOpen: boolean,
  ): void => {
    setError(null)
    void Promise.resolve()
      .then(action)
      .then(() => {
        const latest = loadPrefs()
        updatePrefs({ ...latest, recent: pushRecent(latest, entry.id) })
        if (!keepOpen) close()
      })
      .catch(showError)
  }, [close, showError, updatePrefs])

  /** Execute an entry directly or open its second-level choice list. */
  const invokeEntry = useCallback((entry: PaletteEntry): void => {
    setError(null)
    if (entry.choices !== undefined) {
      let choices: readonly PaletteChoice[] | null
      try {
        choices = entry.choices()
      } catch (reason) {
        showError(reason)
        return
      }
      if (choices !== null && choices.length > 0) {
        setOpen(true)
        setSub({ entry, choices })
        setQuery('')
        setActive(0)
        setRecording(null)
        return
      }
    }
    if (entry.execute !== undefined) execute(entry, entry.execute, entry.keepOpen === true)
  }, [execute, showError])

  /** Execute one second-level choice. */
  const invokeChoice = useCallback((entry: PaletteEntry, choice: PaletteChoice): void => {
    execute(entry, choice.execute, choice.keepOpen === true)
  }, [execute])

  /** Find the command/palette whose effective shortcut conflicts with a candidate. */
  const conflictOwner = useCallback((
    candidate: Hotkey,
    targetEntryId: string | undefined,
    currentPrefs: PalettePrefs,
  ): string | undefined => {
    if (targetEntryId !== undefined && sameHotkey(candidate, effectiveHotkey(currentPrefs))) {
      return t('overlay.aria')
    }
    for (const entry of allEntries()) {
      if (entry.id === targetEntryId) continue
      const binding = effectiveEntryHotkey(currentPrefs, entry)
      if (binding !== null && sameHotkey(candidate, binding)) {
        return labelOf(t, entry.labelKey, entry.label)
      }
    }
    return undefined
  }, [allEntries, t])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const state = stateRef.current
      if (state.recording !== null) {
        event.preventDefault()
        if (event.key === 'Escape') {
          setRecording(null)
          setError(null)
          return
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
          const latest = loadPrefs()
          updatePrefs(state.recording.entryId === undefined
            ? { ...latest, hotkey: null }
            : setEntryHotkey(latest, state.recording.entryId, null))
          setRecording(null)
          setError(null)
          return
        }
        const captured = eventToHotkey(event)
        if (captured === null) return
        if (!isGlobalHotkey(captured)) {
          setError(t('status.shortcutModifier'))
          return
        }
        const latest = loadPrefs()
        const conflict = conflictOwner(captured, state.recording.entryId, latest)
        if (conflict !== undefined) {
          setError(t('status.shortcutConflict', { entry: conflict }))
          return
        }
        updatePrefs(state.recording.entryId === undefined
          ? { ...latest, hotkey: captured }
          : setEntryHotkey(latest, state.recording.entryId, captured))
        setRecording(null)
        setError(null)
        return
      }

      if (event.repeat) return
      if (matchesHotkey(event, state.hotkey)) {
        event.preventDefault()
        if (state.open) close()
        else openPalette()
        return
      }

      const direct = allEntries().find(entry => {
        const binding = effectiveEntryHotkey(state.prefs, entry)
        return binding !== null && matchesHotkey(event, binding)
      })
      if (direct !== undefined) {
        event.preventDefault()
        invokeEntry(direct)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allEntries, close, conflictOwner, invokeEntry, openPalette, t, updatePrefs])

  // Shortcut-settings entries ask the runtime to capture either palette-open
  // (undefined) or one direct command binding.
  useEffect(() => {
    palette.onRecordingRequest(entryId => {
      const entry = entryId === undefined ? undefined : allEntries().find(candidate => candidate.id === entryId)
      setOpen(true)
      setSub(null)
      setQuery('')
      setActive(0)
      setError(null)
      setRecording({
        ...(entryId === undefined ? {} : { entryId }),
        label: entry === undefined ? t('overlay.aria') : labelOf(t, entry.labelKey, entry.label),
      })
    })
    return () => palette.onRecordingRequest(null)
  }, [allEntries, palette, t])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, sub])

  const visibleEntries = useMemo(
    () => allEntries().filter(entry => !prefs.hidden.includes(entry.id)),
    [allEntries, prefs.hidden, open, sub],
  )

  const rows: readonly Row[] = useMemo(() => {
    if (sub !== null) {
      return rankItems(sub.choices.map(choice => ({
        label: choice.label,
        detail: choice.detail,
        row: { entry: sub.entry, choice },
      })), query).map(scored => scored.row)
    }
    const project = (entry: PaletteEntry): {
      label: string
      detail: string | undefined
      keywords: readonly string[] | undefined
      id: string
      row: Row
    } => ({
      label: labelOf(t, entry.labelKey, entry.label),
      detail: labelOf(t, entry.detailKey, entry.detail) || undefined,
      keywords: entry.keywords,
      id: entry.id,
      row: { entry },
    })
    if (query === '') {
      // Single row order source: rendering and keyboard navigation consume
      // this exact sequence.
      const conversations = palette.recentSessions()
        .filter(entry => !prefs.hidden.includes(entry.id))
      const conversationIds = new Set(conversations.map(entry => entry.id))
      const rankOf = (entry: PaletteEntry): number => {
        if (prefs.pinned.includes(entry.id)) return 0
        if (prefs.recent.includes(entry.id)) return 1
        return 2
      }
      const others = GROUP_ORDER.flatMap(group => [...visibleEntries
        .filter(entry => entry.group === group && !conversationIds.has(entry.id))]
        .sort((a, b) => rankOf(a) - rankOf(b)))
      return [...conversations, ...others].map(entry => project(entry).row)
    }
    return rankItems(visibleEntries.map(project), query).map(scored => scored.row)
  }, [sub, query, visibleEntries, prefs.pinned, prefs.recent, prefs.hidden, palette, t])

  useEffect(() => {
    setActive(0)
  }, [query, sub])

  useEffect(() => {
    if (rows[active] === undefined) return
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows])

  if (!open) return null

  const run = (row: Row): void => {
    if (row.choice !== undefined) invokeChoice(row.entry, row.choice)
    else invokeEntry(row.entry)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing || recording !== null) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(current => (rows.length === 0 ? 0 : (current + 1) % rows.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(current => (rows.length === 0 ? 0 : (current - 1 + rows.length) % rows.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[active]
      if (row !== undefined) run(row)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const row = rows[active]
      if (row !== undefined && row.choice === undefined && !query.includes(' ')) {
        setQuery(labelOf(t, row.entry.labelKey, row.entry.label))
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (sub !== null) {
        setSub(null)
        setQuery('')
      } else close()
    }
  }

  const grouped = new Map<PaletteEntry['group'], Row[]>()
  for (const row of rows) {
    const list = grouped.get(row.entry.group) ?? []
    list.push(row)
    grouped.set(row.entry.group, list)
  }

  return (
    <div className="dsh-palette-root" role="dialog" aria-label={t('overlay.aria')}>
      <div className="dsh-palette-mask" onMouseDown={close} />
      <div className="dsh-palette-card">
        <input
          ref={inputRef}
          className="dsh-palette-search"
          value={query}
          placeholder={sub !== null
            ? t('search.placeholder.sub', { entry: labelOf(t, sub.entry.labelKey, sub.entry.label) })
            : t('search.placeholder')}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="dsh-palette-list" ref={listRef}>
          {rows.length === 0 && <div className="dsh-palette-empty">{t('status.empty')}</div>}
          {sub !== null
            ? rows.map((row, i) => (
              <div
                key={row.choice!.id}
                className="dsh-palette-row"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(row)}
              >
                <span className="dsh-palette-row-main">{row.choice!.label}</span>
                {row.choice!.detail !== undefined && (
                  <span className="dsh-palette-row-detail">{row.choice!.detail}</span>
                )}
              </div>
            ))
            : (() => {
              let index = 0
              return GROUP_ORDER.flatMap(group => {
                const list = grouped.get(group)
                if (list === undefined) return []
                return [
                  <div key={`group-${group}`} className="dsh-palette-group">{t(GROUP_KEY[group])}</div>,
                  ...list.map(row => {
                    const i = index++
                    const binding = effectiveEntryHotkey(prefs, row.entry)
                    return (
                      <div
                        key={row.entry.id}
                        className="dsh-palette-row"
                        data-active={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => run(row)}
                      >
                        <span className="dsh-palette-row-main">
                          {labelOf(t, row.entry.labelKey, row.entry.label)}
                        </span>
                        {labelOf(t, row.entry.detailKey, row.entry.detail) !== '' && (
                          <span className="dsh-palette-row-detail">{labelOf(t, row.entry.detailKey, row.entry.detail)}</span>
                        )}
                        {binding !== null && (
                          <span className="dsh-palette-row-shortcut">{formatHotkey(binding)}</span>
                        )}
                        {row.entry.choices !== undefined && (
                          <span className="dsh-palette-row-hint">{t('row.hint.sub')}</span>
                        )}
                      </div>
                    )
                  }),
                ]
              })
            })()}
        </div>
        {recording !== null && (
          <div className="dsh-palette-note" data-kind="recording">
            {recording.entryId === undefined
              ? t('status.recording')
              : t('status.recordingEntry', { entry: recording.label })}
          </div>
        )}
        {error !== null && (
          <div className="dsh-palette-note" data-kind="error">{error}</div>
        )}
        <div className="dsh-palette-footer">
          <span>↑↓ · Enter · Tab · Esc</span>
          <span className="dsh-palette-footer-kbd">{formatHotkey(hotkey)}</span>
        </div>
      </div>
    </div>
  )
}
