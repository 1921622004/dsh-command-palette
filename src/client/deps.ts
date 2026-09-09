/**
 * Minimal structural types for the harness services the palette consumes.
 * Out-of-tree declaration of the in-repo faces (`api/session-controller`,
 * `ui-theme`, `locale`); every member is read-only surface the palette calls.
 */
import type { PaletteKey } from './locales.ts'

/** One client session-list row (`SessionSummary` projection). */
export interface SessionRow {
  readonly id: string
  /** Human-facing label: durable title, project basename, then session id. */
  readonly displayTitle: string
  readonly running: boolean
  /** Empty-log bit: a reusable fresh session of its workspace. */
  readonly blank?: boolean
  /** Absolute working directory, when the host projected one. */
  readonly cwd?: string
  /** Host-list update stamp (descending recency order). */
  readonly updatedAt?: number
  /** Coarse durable origin; 'subagent' rows are addressed via their parent's catalog. */
  readonly origin?: 'subagent'
}

/** One workspace row (`WorkspaceView` projection slice). */
export interface WorkspaceRow {
  readonly workspaceId: string
  readonly sessionIds: readonly string[]
}

/** The `sessions` service face the palette reads/writes. */
export interface SessionsFace {
  readonly list: {
    getSnapshot(): {
      readonly ids: readonly string[]
      readonly byId: Readonly<Record<string, SessionRow | undefined>>
      readonly current: string | undefined
    }
  }
  create(opts?: { readonly workspaceId?: string }): Promise<string>
  open(id: string): void
  /** Resolve the current session's behavior verbs; undefined when unbound. */
  binding(id: string): {
    readonly session: {
      cancel(): Promise<unknown>
      /** Execute one slash-command line against the session's agent. */
      command(line: string): Promise<unknown>
    }
  } | undefined
}

/** Built-in theme preferences (`ui-theme`'s closed set). */
export type ThemePreference = 'light' | 'dark' | 'system'

/** The `theme` service face the palette writes. */
export interface ThemeFace {
  setTheme(id: ThemePreference): void
}

/** The `workspaces` service face the palette reads/writes. */
export interface WorkspacesFace {
  readonly list: {
    getSnapshot(): {
      readonly items: readonly WorkspaceRow[]
      readonly archivedSessionIds: readonly string[]
    }
  }
  /** Archive one session (it leaves every grouping surface). */
  archiveSession(sessionId: string): Promise<void>
}

/** The `locale` service face: dictionary registration and binding. */
export interface LocaleFace {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
  bind(ns: string): (key: string, params?: Record<string, unknown>) => string
}

/** Translate over the palette namespace (typed key when compiled in-repo). */
export type PaletteTranslate = (key: PaletteKey, params?: Record<string, unknown>) => string
