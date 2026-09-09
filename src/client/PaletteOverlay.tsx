/**
 * The palette overlay: the shell.overlay entry that renders the ⌘K popup.
 * Component-internal state only (open/query/highlight/sub-level/recording);
 * the entry list, sub-level choices, and actions all cross in through the
 * injected runtime face, and copy rides the standard `t` seat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import type { PaletteChoice, PaletteEntry, PalettePrefs } from './contract.ts'
import type { PaletteKey } from './locales.ts'
import type { PaletteRuntime } from './service.ts'
import { rankItems } from './fuzzy.ts'
import { eventToHotkey, formatHotkey, matchesHotkey } from './hotkey.ts'
import { effectiveHotkey, loadPrefs, pushRecent, savePrefs } from './prefs.ts'

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

/** Resolve one entry's display label through the locale seat. */
function labelOf(t: PaletteOverlayProps['t'], key: PaletteKey | undefined, literal: string | undefined): string {
  return key !== undefined ? t(key) : literal ?? ''
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
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PalettePrefs>(() => loadPrefs())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const hotkey = effectiveHotkey(prefs)
  // The listener reads current state through refs so one window listener
  // covers open/close, sub-level navigation, and recording capture.
  const stateRef = useRef({ open, recording, hotkey })
  stateRef.current = { open, recording, hotkey }

  const close = useCallback(() => {
    setOpen(false)
    setSub(null)
    setQuery('')
    setError(null)
    setRecording(false)
  }, [])

  const openPalette = useCallback(() => {
    setOpen(true)
    setSub(null)
    setQuery('')
    setActive(0)
    setError(null)
    setRecording(false)
  }, [])

  const updatePrefs = useCallback((next: PalettePrefs) => {
    setPrefs(next)
    savePrefs(next)
  }, [])

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const state = stateRef.current
      if (state.recording) {
        event.preventDefault()
        if (event.key === 'Escape') {
          setRecording(false)
          return
        }
        const captured = eventToHotkey(event)
        if (captured !== null) updatePrefs({ ...(loadPrefs()), hotkey: captured })
        setRecording(false)
        return
      }
      if (matchesHotkey(event, state.hotkey)) {
        event.preventDefault()
        if (state.open) close()
        else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, openPalette, updatePrefs])

  // The hotkey entry asks the runtime to start recording; the view owns capture.
  useEffect(() => {
    palette.onRecordingRequest(() => {
      setRecording(true)
      setError(null)
    })
    return () => palette.onRecordingRequest(null)
  }, [palette])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open, sub])

  const visibleEntries = useMemo(
    () => [...palette.entries(), ...palette.dynamicEntries()]
      .filter(entry => !prefs.hidden.includes(entry.id)),
    [palette, prefs.hidden, open, sub],
  )

  const rows: readonly Row[] = useMemo(() => {
    if (sub !== null) {
      return rankItems(sub.choices.map(choice => ({
        label: choice.label,
        detail: choice.detail,
        row: { entry: sub.entry, choice },
      })), query).map(scored => scored.row)
    }
    const project = (entry: PaletteEntry): { label: string, detail: string | undefined, keywords: readonly string[] | undefined, id: string, row: Row } => ({
      label: labelOf(t, entry.labelKey, entry.label),
      detail: labelOf(t, entry.detailKey, entry.detail) || undefined,
      keywords: entry.keywords,
      id: entry.id,
      row: { entry } as Row,
    })
    if (query === '') {
      // Single source of row order, matching the grouped rendering exactly:
      // GROUP_ORDER groups; within the session group the recent
      // conversations lead; inside every group pinned entries come first,
      // then recently-used commands, then registration order. The
      // keyboard-nav array and the rendered rows are then the same
      // sequence — index i addresses the same row in both.
      const conversations = palette.recentSessions()
        .filter(entry => !prefs.hidden.includes(entry.id))
      const conversationIds = new Set(conversations.map(entry => entry.id))
      const rankOf = (entry: PaletteEntry): number => {
        if (prefs.pinned.includes(entry.id)) return 0
        if (prefs.recent.includes(entry.id)) return 1
        return 2
      }
      const others = GROUP_ORDER
        .flatMap(group => [...visibleEntries
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
    setError(null)
    if (row.choice !== undefined) {
      void Promise.resolve(row.choice.execute())
        .then(() => {
          updatePrefs({ ...(loadPrefs()), recent: pushRecent(loadPrefs(), row.entry.id) })
          close()
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      return
    }
    const { entry } = row
    if (entry.choices !== undefined) {
      const choices = entry.choices()
      if (choices !== null && choices.length > 0) {
        setSub({ entry, choices })
        setQuery('')
        setActive(0)
        return
      }
    }
    if (entry.execute !== undefined) {
      void Promise.resolve(entry.execute())
        .then(() => {
          updatePrefs({ ...(loadPrefs()), recent: pushRecent(loadPrefs(), entry.id) })
          close()
        })
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
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
      if (recording) setRecording(false)
      else if (sub !== null) {
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
              // Global row index across groups: the highlight addresses the
              // flat row list, never a group-local position.
              let index = 0
              return GROUP_ORDER.flatMap(group => {
                const list = grouped.get(group)
                if (list === undefined) return []
                return [
                  <div key={`group-${group}`} className="dsh-palette-group">{t(GROUP_KEY[group])}</div>,
                  ...list.map(row => {
                    const i = index++
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
        {recording && <div className="dsh-palette-note" data-kind="recording">{t('status.recording')}</div>}
        {error !== null && (
          <div className="dsh-palette-note" data-kind="error">{t('status.error', { message: error })}</div>
        )}
        <div className="dsh-palette-footer">
          <span>↑↓ · Enter · Tab · Esc</span>
          <span className="dsh-palette-footer-kbd">{formatHotkey(hotkey)}</span>
        </div>
      </div>
    </div>
  )
}
