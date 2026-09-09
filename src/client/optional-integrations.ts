/**
 * Optional DOM-driven integrations (dsh-task-board / dsh-skill-explorer /
 * dsh-pet, whether installed standalone or through a dsh-web-all aggregate —
 * the families share one codebase and one set of stable hooks). Task-board
 * and skill-explorer are probed from live DOM hooks on every entry read; pet
 * uses one same-origin API probe because its DOM root unmounts while hidden:
 *
 * - task-board: the `[data-dsh-taskboard-entry]` sidebar button toggles the
 *   board; `data-dsh-taskboard-active` on <html> marks it open.
 * - skill-explorer: the `[data-dsh-skill-explorer-entry]` sidebar button
 *   toggles the skill center overlay.
 * - pet: same-origin `/api/pet/*` JSON endpoints (`set-visible`); the host
 *   half serves them whenever the pet plugin is active, so the API doubles
 *   as the presence probe (the DOM root unmounts while hidden).
 */
import type { PaletteEntry } from './contract.ts'
import { modHotkey } from './hotkey.ts'

/** One sidebar entry button by its row attribute, when present. */
function sidebarButton(selector: string): HTMLButtonElement | undefined {
  const button = document.querySelector<HTMLButtonElement>(selector)
  return button ?? undefined
}

/** Whether the task board currently holds the center column. */
function boardActive(): boolean {
  return document.documentElement.hasAttribute('data-dsh-taskboard-active')
}

/** One same-origin JSON call against the pet host API. */
async function petFetch(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, body === undefined
    ? {}
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`pet ${path} failed: ${String(response.status)}`)
  return response.json()
}

export interface PetProbe {
  /** Whether the pet host API answered the presence probe. */
  alive(): boolean
  /** Re-run the presence probe (fire-and-forget). */
  refresh(): void
  /** POST the visibility verb. */
  setVisible(visible: boolean): Promise<void>
}

/** Create the pet API probe state. */
export function createPetProbe(): PetProbe {
  let alive = false
  return {
    alive: () => alive,
    refresh() {
      void petFetch('/api/pet/pets')
        .then(() => { alive = true }, () => { alive = false })
    },
    setVisible: async visible => void await petFetch('/api/pet/set-visible', { visible }),
  }
}

/**
 * Compute the optional integration entries for one palette open.
 * @param pet - the pet API probe.
 * @returns entries for every integration whose plugin is present.
 */
export function optionalIntegrationEntries(pet: PetProbe): readonly PaletteEntry[] {
  const entries: PaletteEntry[] = []
  const board = sidebarButton('[data-dsh-taskboard-entry]')
  if (board !== undefined) {
    entries.push({
      id: 'palette.integration.taskboard',
      group: 'extension',
      labelKey: boardActive() ? 'entry.board.close' : 'entry.board.open',
      detailKey: 'entry.board.detail',
      keywords: ['task', 'board', 'kanban'],
      defaultHotkey: modHotkey('b', { alt: true }),
      execute: () => board.click(),
    })
  }
  const skills = sidebarButton('[data-dsh-skill-explorer-entry]')
  if (skills !== undefined) {
    entries.push({
      id: 'palette.integration.skills',
      group: 'extension',
      labelKey: 'entry.skills.open',
      detailKey: 'entry.skills.detail',
      keywords: ['skill', 'skills', 'center'],
      defaultHotkey: modHotkey('s', { alt: true }),
      execute: () => skills.click(),
    })
  }
  if (pet.alive()) {
    entries.push({
      id: 'palette.integration.pet.show',
      group: 'extension',
      labelKey: 'entry.pet.show',
      detailKey: 'entry.pet.detail',
      keywords: ['pet', 'show'],
      defaultHotkey: modHotkey('p', { alt: true }),
      execute: () => pet.setVisible(true),
    }, {
      id: 'palette.integration.pet.hide',
      group: 'extension',
      labelKey: 'entry.pet.hide',
      detailKey: 'entry.pet.detail',
      keywords: ['pet', 'hide'],
      defaultHotkey: modHotkey('p', { alt: true, shift: true }),
      execute: () => pet.setVisible(false),
    })
  }
  return entries
}
