/**
 * Command palette plugin, browser half. Provides `ctx.commandPalette`
 * (the quick-entry registry), registers the `palette` dictionaries, mounts
 * the built-in entries over the live `sessions`/`theme` services, and
 * registers the overlay view into `shell.overlay`.
 */
import type { LocaleFace, SessionsFace, ThemeFace, WorkspacesFace } from './deps.ts'
import { en, zh } from './locales.ts'
import { registerBuiltins } from './builtin.ts'
import { registerBetterSidebarEntries, type BetterSidebarFace } from './better-sidebar.ts'
import { createPetProbe, optionalIntegrationEntries } from './optional-integrations.ts'
import { PaletteOverlay } from './PaletteOverlay.tsx'
import { createPaletteRuntime } from './service.ts'
import { installPaletteStyles } from './styles.ts'

export { createPaletteRuntime } from './service.ts'
export type { PaletteRuntime } from './service.ts'
export type { BetterSidebarFace } from './better-sidebar.ts'
export type { LocaleFace, SessionsFace, ThemeFace, WorkspacesFace } from './deps.ts'
export type { PaletteEntry, PaletteGroupId, PaletteChoice, PalettePrefs, PaletteRuntimeFace } from './contract.ts'

/** Structural slices of the cordis faces this plugin consumes. */
interface ClientContext {
  effect(register: () => () => void, label?: string): void
  inject(deps: readonly string[], callback: (scope: ClientContext) => void): void
  get(name: string): unknown
  readonly reflect: { provide(name: string, value: unknown): () => void }
  readonly locale: LocaleFace
  readonly slots: {
    inject(name: string, register: () => unknown): void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  readonly sessions: SessionsFace
  readonly workspaces: WorkspacesFace
  readonly theme: ThemeFace
}

/** Stable Cordis plugin name. */
export const name = 'ui-command-palette'

/** Required services: copy, the shell overlay slot, and the live session/workspace/theme faces. */
export const inject = ['locale', 'slots', 'sessions', 'workspaces', 'theme']

/**
 * Client plugin body.
 * @param ctx - browser root context.
 */
export function apply(ctx: ClientContext): void {
  installPaletteStyles()
  ctx.effect(() => ctx.locale.register('palette', { zh, en }), 'ui-command-palette: dictionaries')
  const runtime = createPaletteRuntime(
    (name, value) => ctx.reflect.provide(name, value),
    register => ctx.effect(register, 'ui-command-palette: commandPalette service'),
  )
  const t = ctx.locale.bind('palette')
  ctx.effect(
    () => registerBuiltins(runtime, { sessions: ctx.sessions, workspaces: ctx.workspaces, theme: ctx.theme, t }),
    'ui-command-palette: built-in entries',
  )
  // Optional dsh-better-sidebar integration: entries live exactly while the
  // `betterSidebar` service does (reactive inject, cleaned on its disposal).
  // Optional DOM-driven integrations (task-board / skill-explorer / pet):
  // probed at each palette open, so presence follows the plugins live.
  const pet = createPetProbe()
  pet.refresh()
  runtime.setDynamicEntries(() => {
    pet.refresh()
    return optionalIntegrationEntries(pet)
  })
  ctx.inject(['betterSidebar'], scope => {
    scope.effect(() => {
      const sidebar = scope.get('betterSidebar') as BetterSidebarFace
      return registerBetterSidebarEntries(runtime, sidebar)
    }, 'ui-command-palette: better-sidebar entries')
  })
  ctx.inject(['slots'], scope => {
    scope.slots.inject('shell.overlay', () => scope.slots.register({
      name: 'shell.overlay',
      id: 'command-palette',
      order: 5,
      locale: 'palette',
      inject: () => ({ palette: runtime }),
    }, PaletteOverlay))
  })
}
