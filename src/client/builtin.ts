/**
 * Built-in quick entries over live harness services. Labels ride
 * `palette`-namespace dictionary keys so they follow the active locale;
 * dynamic choice labels (session titles) are literals owned by their source.
 */
import type { PaletteEntry } from './contract.ts'
export type { PaletteEntry }
import type { PaletteRuntime } from './service.ts'
import type {
  PaletteTranslate, SessionsFace, ThemeFace, ThemePreference, WorkspacesFace,
} from './deps.ts'
import { openSettingsSection } from './settings-opener.ts'

/** Services the built-in entries close over. */
export interface BuiltinDeps {
  readonly sessions: SessionsFace
  readonly workspaces: WorkspacesFace
  readonly theme: ThemeFace
  readonly t: PaletteTranslate
}

/** Step to the neighboring session in host-list order; no-op at the ends. */
function stepSession(sessions: SessionsFace, delta: -1 | 1): void {
  const snap = sessions.list.getSnapshot()
  const index = snap.current === undefined ? -1 : snap.ids.indexOf(snap.current)
  const target = snap.ids[index + delta]
  if (target !== undefined && target !== snap.current) sessions.open(target)
}

/**
 * Start the next session: mirror ui-workspace's startSession — target the
 * current session's workspace, else the first listed one; reuse its reusable
 * blank session, else create one; then select it.
 * @param sessions - live sessions face.
 * @param workspaces - live workspaces face.
 */
async function startSession(sessions: SessionsFace, workspaces: WorkspacesFace): Promise<void> {
  const ws = workspaces.list.getSnapshot()
  const snap = sessions.list.getSnapshot()
  const current = snap.current
  const target = (current === undefined
    ? undefined
    : ws.items.find(item => item.sessionIds.includes(current)))
    ?? ws.items[0]
  if (target === undefined) return
  const archived = new Set(ws.archivedSessionIds)
  const blank = snap.ids.find(id => {
    const row = snap.byId[id]
    return row?.blank === true && target.sessionIds.includes(id) && !archived.has(id)
  })
  const id = blank ?? await sessions.create({ workspaceId: target.workspaceId })
  sessions.open(id)
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
 * Register the built-in entries on the runtime.
 * @param runtime - the palette runtime.
 * @param deps - live service faces plus the palette translator.
 * @returns the aggregate disposer.
 */
export function registerBuiltins(runtime: PaletteRuntime, deps: BuiltinDeps): () => void {
  const { sessions, workspaces, theme, t } = deps
  // Recent conversations pinned above the empty-query list: newest first,
  // the current session and reusable blanks excluded.
  runtime.setRecentSessions(() => {
    const snap = sessions.list.getSnapshot()
    return snap.ids
      .filter(id => id !== snap.current)
      .map(id => ({ id, row: snap.byId[id] }))
      .filter((entry): entry is { id: string, row: NonNullable<typeof entry.row> } =>
        entry.row !== undefined && entry.row.blank !== true)
      .sort((a, b) => (b.row.updatedAt ?? 0) - (a.row.updatedAt ?? 0))
      .slice(0, RECENT_SESSION_LIMIT)
      .map(({ id, row }) => ({
        id: `palette.session.recent.${id}`,
        group: 'session' as const,
        label: row.displayTitle,
        keywords: ['session', 'recent'],
        execute: () => sessions.open(id),
      }))
  })
  const disposers = [
    runtime.register({
      id: 'palette.session.new',
      group: 'session',
      labelKey: 'entry.session.new',
      execute: () => startSession(sessions, workspaces),
    }),
    runtime.register({
      id: 'palette.session.prev',
      group: 'session',
      labelKey: 'entry.session.prev',
      execute: () => stepSession(sessions, -1),
    }),
    runtime.register({
      id: 'palette.session.next',
      group: 'session',
      labelKey: 'entry.session.next',
      execute: () => stepSession(sessions, 1),
    }),
    runtime.register({
      id: 'palette.session.switch',
      group: 'session',
      labelKey: 'entry.session.switch',
      detailKey: 'entry.session.switch.detail',
      keywords: ['switch', 'goto'],
      choices: () => {
        const snap = sessions.list.getSnapshot()
        return snap.ids
          .filter(id => id !== snap.current)
          .map(id => ({
            id,
            label: snap.byId[id]?.displayTitle ?? id,
            execute: () => sessions.open(id),
          }))
      },
    }),
    runtime.register({
      id: 'palette.session.openFolder',
      group: 'action',
      labelKey: 'entry.session.openFolder',
      detailKey: 'entry.session.openFolder.detail',
      keywords: ['folder', 'finder', 'explorer', 'directory'],
      execute: () => {
        const snap = sessions.list.getSnapshot()
        const current = snap.current
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
      execute: () => {
        const snap = sessions.list.getSnapshot()
        if (snap.current !== undefined) void workspaces.archiveSession(snap.current)
      },
    }),
    runtime.register({
      id: 'palette.session.interrupt',
      group: 'action',
      labelKey: 'entry.session.interrupt',
      keywords: ['interrupt', 'stop', 'cancel'],
      execute: () => {
        const snap = sessions.list.getSnapshot()
        if (snap.current !== undefined) void sessions.binding(snap.current)?.session.cancel()
      },
    }),
    runtime.register({
      id: 'palette.settings.open',
      group: 'settings',
      labelKey: 'entry.settings.open',
      keywords: ['settings', 'preferences'],
      choices: () => ([
        { id: 'general', label: t('entry.settings.open.general'), execute: () => openSettingsSection(0) },
        { id: 'models', label: t('entry.settings.open.models'), execute: () => openSettingsSection(1) },
        { id: 'plugins', label: t('entry.settings.open.plugins'), execute: () => openSettingsSection(2) },
        { id: 'agent-presets', label: t('entry.settings.open.agentPresets'), execute: () => openSettingsSection(3) },
      ]),
    }),
    runtime.register({
      id: 'palette.settings.theme',
      group: 'settings',
      labelKey: 'entry.settings.theme',
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
      execute: () => runtime.beginHotkeyRecording(),
    }),
  ]
  return () => {
    runtime.setRecentSessions(null)
    for (const dispose of disposers) dispose()
  }
}
