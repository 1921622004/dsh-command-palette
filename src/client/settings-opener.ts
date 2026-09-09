/**
 * Open the settings panel on one section, driving the shipped settings
 * shell's own DOM (the shell owns its open state; there is no external
 * service). Several sidebar triggers are `aria-haspopup="dialog"`, so the
 * settings trigger is identified by its localized label text when present,
 * otherwise by probing: click a candidate, then check whether the dialog
 * that appears carries the settings panel's nav column; wrong candidates
 * are dismissed with Escape before the next try. Sections are addressed by
 * nav order (general=0, models=1, …).
 */

/** Localized settings-trigger labels (the app's `settings.trigger` copy). */
const TRIGGER_LABELS: readonly string[] = ['设置', 'Settings', '設定']

/** Frames to wait for a clicked trigger's dialog to render. */
const SETTLE_ATTEMPTS = 3

/** Whether the open dialog is the settings panel (nav column present). */
function settingsDialogOpen(): boolean {
  return document.querySelector('[role="dialog"] nav') !== null
}

/** Dismiss whatever dialog a wrong candidate opened (the panels close on Escape). */
function dismissDialog(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/** All dialog-trigger candidates, DOM order. */
function triggerCandidates(): readonly HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')]
}

/** One probe round: click `candidate`, settle, then decide. */
function probe(candidate: HTMLButtonElement, rest: readonly HTMLButtonElement[], index: number, attempt: number): void {
  if (settingsDialogOpen()) {
    clickNav(index, 1)
    return
  }
  if (attempt > SETTLE_ATTEMPTS) {
    // This candidate opened nothing recognizable; try the next one.
    const next = rest[0]
    if (next === undefined) return
    probe(next, rest.slice(1), index, 1)
    return
  }
  if (attempt === 1) candidate.click()
  requestAnimationFrame(() => {
    if (settingsDialogOpen()) {
      clickNav(index, 1)
      return
    }
    // A dialog appeared but has no nav column: wrong trigger — close it.
    if (document.querySelector('[role="dialog"]') !== null) dismissDialog()
    requestAnimationFrame(() => probe(candidate, rest, index, attempt + 1))
  })
}

/** Click the settings nav button at `index`, retrying while React renders. */
function clickNav(index: number, attempt: number): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] nav button')
  if (buttons.length > 0) {
    const target = buttons[Math.min(index, buttons.length - 1)]
    if (target !== undefined) target.click()
    return
  }
  if (attempt < SETTLE_ATTEMPTS) {
    requestAnimationFrame(() => clickNav(index, attempt + 1))
  }
}

/**
 * Open the settings panel, optionally navigating straight to one section.
 * @param index - nav position of the section (0 = first); -1 opens the
 *   panel without choosing a section.
 */
export function openSettingsSection(index: number): void {
  const candidates = triggerCandidates()
  // Fast path: the wide sidebar renders the trigger's localized label.
  const labeled = candidates.find(button => {
    const text = button.textContent ?? ''
    return TRIGGER_LABELS.some(label => text.includes(label))
  })
  if (labeled !== undefined) {
    labeled.click()
    if (index >= 0) clickNav(index, 1)
    return
  }
  // Rail sidebar (icon only): probe candidates in order.
  const first = candidates[0]
  if (first !== undefined) probe(first, candidates.slice(1), index, 1)
}
