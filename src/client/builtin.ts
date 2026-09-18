/**
 * Built-in quick entries over live harness services. Labels ride
 * `palette`-namespace dictionary keys so they follow the active locale;
 * dynamic choice labels (session titles) are literals owned by their source.
 */
import type { PaletteEntry } from './contract.ts'
export type { PaletteEntry }
import type { PaletteRuntime } from './service.ts'
import type {
  PaletteTranslate, SessionsFace, ThemeFace, ThemePreference, WorkspacesFace, WorkspaceUiFace,
} from './deps.ts'
import { formatHotkey, modHotkey } from './hotkey.ts'
import { effectiveEntryHotkey, loadPrefs } from './prefs.ts'
import { openSettingsSection } from './settings-opener.ts'

/** Services the built-in entries close over. */
export interface BuiltinDeps {
  readonly sessions: SessionsFace
  readonly workspaces: WorkspacesFace
  readonly ui: WorkspaceUiFace
  readonly theme: ThemeFace
  readonly t: PaletteTranslate
}

/**
 * The session the main view shows: the row the host retains through its
 * `mainView` reference source. Upstream removed the list-level `current`
 * field ("navigation belongs to view owners"); retention is the surviving
 * authority, the same one `ui-session` reads to project the main binding.
 */
function currentSessionId(snap: ReturnType<SessionsFace['list']['getSnapshot']>): string | undefined {
  return snap.ids.find(id => (snap.byId[id]?.retainedBy?.mainView ?? 0) > 0)
}

/** Step to the neighboring session in host-list order; no-op at the ends. */
function stepSession(ui: WorkspaceUiFace, sessions: SessionsFace, delta: -1 | 1): void {
  const snap = sessions.list.getSnapshot()
  const current = currentSessionId(snap)
  const index = current === undefined ? -1 : snap.ids.indexOf(current)
  const target = snap.ids[index + delta]
  if (target !== undefined && target !== current) ui.openSession(target)
}

/** Resolve one entry's display label for the shortcut settings list. */
function entryLabel(entry: PaletteEntry, t: PaletteTranslate): string {
  return entry.labelKey !== undefined ? t(entry.labelKey) : entry.label ?? entry.id
}

/** Preference ids in the palette's display order. */
const THEME_ORDER: readonly ThemePreference[] = ['light', 'dark', 'system']
const THEME_KEY: Record<ThemePreference, 'entry.settings.theme.light' | 'entry.settings.theme.dark' | 'entry.settings.theme.system'> = {
  light: 'entry.settings.theme.light',
  dark: 'entry.settings.theme.dark',
  system: 'entry.settings.theme.system',
}

/** Cap on recent-conversation rows pinned above the empty-query list. */
const RECENT_SESSION_LIMIT = 5

/**
 * Map every session to its workspace title from live membership: the data
 * source of the project tag on session rows.
 * @param workspaces - live workspaces face.
 * @returns session id → workspace title; sessions outside every workspace are absent.
 */
function workspaceTitleBySession(workspaces: WorkspacesFace): Map<string, string> {
  const titles = new Map<string, string>()
  for (const workspace of workspaces.list.getSnapshot().items) {
    for (const id of workspace.sessionIds) titles.set(id, workspace.title)
  }
  return titles
}

/**
 * Register the built-in entries on the runtime.
 * @param runtime - the palette runtime.
 * @param deps - live service faces plus the palette translator.
 * @returns the aggregate disposer.
 */
export function registerBuiltins(runtime: PaletteRuntime, deps: BuiltinDeps): () => void {
  const { sessions, workspaces, ui, theme, t } = deps
  // Recent conversations pinned above the empty-query list: newest first,
  // the current session, reusable blanks, and subagent sessions excluded
  // (subagents are addressed through their parent's catalog, not top-level
  // navigation).
  runtime.setRecentSessions(() => {
    const snap = sessions.list.getSnapshot()
    const workspaceTitles = workspaceTitleBySession(workspaces)
    return snap.ids
      .filter(id => id !== currentSessionId(snap))
      .map(id => ({ id, row: snap.byId[id] }))
      .filter((entry): entry is { id: string, row: NonNullable<typeof entry.row> } =>
        entry.row !== undefined
        && entry.row.blank !== true
        && entry.row.origin !== 'subagent')
      .sort((a, b) => (b.row.updatedAt ?? 0) - (a.row.updatedAt ?? 0))
      .slice(0, RECENT_SESSION_LIMIT)
      .map(({ id, row }) => {
        const tag = workspaceTitles.get(id)
        return {
          id: `palette.session.recent.${id}`,
          group: 'session' as const,
          label: row.displayTitle,
          // The project name also matches the query, so typing it finds its sessions.
          keywords: tag === undefined ? ['session', 'recent'] : ['session', 'recent', tag],
          ...(tag === undefined ? {} : { tag }),
          execute: () => ui.openSession(id),
        }
      })
  })
  const disposers = [
    runtime.register({
      id: 'palette.session.new',
      group: 'session',
      labelKey: 'entry.session.new',
      defaultHotkey: modHotkey('n', { alt: true }),
      execute: () => ui.startSession(),
    }),
    runtime.register({
      id: 'palette.session.prev',
      group: 'session',
      labelKey: 'entry.session.prev',
      defaultHotkey: modHotkey('ArrowUp', { alt: true }),
      execute: () => stepSession(ui, sessions, -1),
    }),
    runtime.register({
      id: 'palette.session.next',
      group: 'session',
      labelKey: 'entry.session.next',
      defaultHotkey: modHotkey('ArrowDown', { alt: true }),
      execute: () => stepSession(ui, sessions, 1),
    }),
    runtime.register({
      id: 'palette.session.switch',
      group: 'session',
      labelKey: 'entry.session.switch',
      detailKey: 'entry.session.switch.detail',
      keywords: ['switch', 'goto'],
      defaultHotkey: modHotkey('g', { alt: true }),
      choices: () => {
        const snap = sessions.list.getSnapshot()
        const workspaceTitles = workspaceTitleBySession(workspaces)
        return snap.ids
          .filter(id => id !== currentSessionId(snap) && snap.byId[id]?.origin !== 'subagent')
          .map(id => {
            const tag = workspaceTitles.get(id)
            return {
              id,
              label: snap.byId[id]?.displayTitle ?? id,
              ...(tag === undefined ? {} : { tag }),
              execute: () => ui.openSession(id),
            }
          })
      },
    }),
    runtime.register({
      id: 'palette.session.openFolder',
      group: 'action',
      labelKey: 'entry.session.openFolder',
      detailKey: 'entry.session.openFolder.detail',
      keywords: ['folder', 'finder', 'explorer', 'directory'],
      defaultHotkey: modHotkey('o', { alt: true }),
      execute: () => {
        const snap = sessions.list.getSnapshot()
        const current = currentSessionId(snap)
        if (current === undefined) return
        const cwd = snap.byId[current]?.cwd
        if (cwd === undefined) return
        void sessions.binding(current)?.session.command(`/open-folder ${cwd}`)
      },
    }),
    runtime.register({
      id: 'palette.session.archive',
      group: 'action',
      labelKey: 'entry.session.archive',
      keywords: ['archive'],
      defaultHotkey: modHotkey('a', { alt: true }),
      execute: () => {
        const snap = sessions.list.getSnapshot()
        const current = currentSessionId(snap)
        if (current !== undefined) void workspaces.archiveSession(current)
      },
    }),
    runtime.register({
      id: 'palette.session.rename',
      group: 'action',
      labelKey: 'entry.session.rename',
      detailKey: 'entry.session.rename.detail',
      keywords: ['rename', 'title'],
      keepOpen: true,
      execute: () => {
        const snap = sessions.list.getSnapshot()
        const current = currentSessionId(snap)
        if (current === undefined) return
        runtime.beginRename({
          sessionId: current,
          original: snap.byId[current]?.displayTitle ?? current,
          confirm: async title => {
            const binding = sessions.binding(current)
            if (binding === undefined) throw new Error('session unavailable')
            const result = await binding.session.rename(title)
            if (!result.ok) throw new Error(result.error.message)
          },
        })
      },
    }),
    runtime.register({
      id: 'palette.session.interrupt',
      group: 'action',
      labelKey: 'entry.session.interrupt',
      keywords: ['interrupt', 'stop', 'cancel'],
      defaultHotkey: modHotkey('x', { alt: true }),
      execute: () => {
        const snap = sessions.list.getSnapshot()
        const current = currentSessionId(snap)
        if (current !== undefined) void sessions.binding(current)?.session.cancel()
      },
    }),
    runtime.register({
      id: 'palette.settings.open',
      group: 'settings',
      labelKey: 'entry.settings.open',
      keywords: ['settings', 'preferences'],
      defaultHotkey: modHotkey(',', { alt: true }),
      choices: () => ([
        {
          id: 'general', label: t('entry.settings.open.general'),
          execute: () => openSettingsSection(t('entry.settings.open.general'), 0),
        },
        {
          id: 'models', label: t('entry.settings.open.models'),
          execute: () => openSettingsSection(t('entry.settings.open.models'), 1),
        },
        {
          id: 'plugins', label: t('entry.settings.open.plugins'),
          execute: () => openSettingsSection(t('entry.settings.open.plugins'), 2),
        },
        {
          id: 'agent-presets', label: t('entry.settings.open.agentPresets'),
          execute: () => openSettingsSection(t('entry.settings.open.agentPresets'), 3),
        },
      ]),
    }),
    runtime.register({
      id: 'palette.settings.theme',
      group: 'settings',
      labelKey: 'entry.settings.theme',
      defaultHotkey: modHotkey('t', { alt: true }),
      choices: () => THEME_ORDER.map(pref => ({
        id: pref,
        label: t(THEME_KEY[pref]),
        execute: () => theme.setTheme(pref),
      })),
    }),
    runtime.register({
      id: 'palette.settings.hotkey',
      group: 'settings',
      labelKey: 'entry.settings.hotkey',
      detailKey: 'entry.settings.hotkey.detail',
      keywords: ['hotkey', 'shortcut', 'keybinding'],
      defaultHotkey: modHotkey('k', { alt: true }),
      keepOpen: true,
      execute: () => runtime.beginHotkeyRecording(),
    }),
    runtime.register({
      id: 'palette.settings.bindings',
      group: 'settings',
      labelKey: 'entry.settings.bindings',
      detailKey: 'entry.settings.bindings.detail',
      keywords: ['hotkey', 'shortcut', 'keybinding'],
      defaultHotkey: modHotkey('k', { alt: true, shift: true }),
      choices: () => {
        const prefs = loadPrefs()
        const entries = new Map(
          [...runtime.entries(), ...runtime.dynamicEntries()]
            .map(entry => [entry.id, entry] as const),
        )
        return [...entries.values()]
          .map(entry => {
            const binding = effectiveEntryHotkey(prefs, entry)
            return {
              id: entry.id,
              label: entryLabel(entry, t),
              detail: binding === null ? t('shortcut.none') : formatHotkey(binding),
              keepOpen: true,
              execute: () => runtime.beginHotkeyRecording(entry.id),
            }
          })
      },
    }),
  ]
  return () => {
    runtime.setRecentSessions(null)
    for (const dispose of disposers) dispose()
  }
}
