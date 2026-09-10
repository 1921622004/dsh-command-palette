/**
 * Open the shipped settings dialog and select one section. The shell keeps
 * open/section state inside React, so this compatibility adapter targets its
 * stable accessible trigger and nav labels. The old positional index remains
 * only as a fallback for earlier shells.
 */

/** Localized settings-trigger labels (the app's `settings.trigger` copy). */
const TRIGGER_LABELS: readonly string[] = ['设置', 'Settings', '設定']

/** Frames to wait for a clicked trigger's dialog to render. */
const SETTLE_ATTEMPTS = 3

/** Normalize one accessible label for comparisons. */
function normalized(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/** Whether text/aria-label identifies the official settings trigger (exact label). */
export function isSettingsTrigger(text: string, ariaLabel: string | null): boolean {
  const values = [text, ariaLabel ?? ''].map(normalized)
  return TRIGGER_LABELS.some(label => values.some(value => value === normalized(label)))
}

/**
 * Resolve the target section by label, retaining an index fallback for older
 * shells or translations whose title differs.
 */
export function settingsNavIndex(
  labels: readonly string[],
  targetLabel: string,
  fallbackIndex: number,
): number | undefined {
  const target = normalized(targetLabel)
  const exact = labels.findIndex(label => normalized(label) === target)
  if (exact !== -1) return exact
  const partial = labels.findIndex(label => {
    const candidate = normalized(label)
    return candidate.includes(target) || target.includes(candidate)
  })
  if (partial !== -1) return partial
  if (labels.length === 0) return undefined
  return Math.min(Math.max(fallbackIndex, 0), labels.length - 1)
}

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

/** Click the requested settings nav row, retrying while React renders. */
function clickNav(targetLabel: string, fallbackIndex: number, attempt: number): void {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] nav button')]
  const index = settingsNavIndex(buttons.map(button => button.textContent ?? ''), targetLabel, fallbackIndex)
  if (index !== undefined) {
    buttons[index]?.click()
    return
  }
  if (attempt < SETTLE_ATTEMPTS) {
    requestAnimationFrame(() => clickNav(targetLabel, fallbackIndex, attempt + 1))
  }
}

/** One probe round: click a candidate, settle, then decide. */
function probe(
  candidate: HTMLButtonElement,
  rest: readonly HTMLButtonElement[],
  targetLabel: string,
  fallbackIndex: number,
  attempt: number,
): void {
  if (settingsDialogOpen()) {
    clickNav(targetLabel, fallbackIndex, 1)
    return
  }
  if (attempt > SETTLE_ATTEMPTS) {
    const next = rest[0]
    if (next !== undefined) probe(next, rest.slice(1), targetLabel, fallbackIndex, 1)
    return
  }
  if (attempt === 1) candidate.click()
  requestAnimationFrame(() => {
    if (settingsDialogOpen()) {
      clickNav(targetLabel, fallbackIndex, 1)
      return
    }
    if (document.querySelector('[role="dialog"]') !== null) dismissDialog()
    requestAnimationFrame(() => probe(candidate, rest, targetLabel, fallbackIndex, attempt + 1))
  })
}

/**
 * Open settings directly on one section.
 * @param targetLabel - localized section label.
 * @param fallbackIndex - known position for an earlier shell.
 */
export function openSettingsSection(targetLabel: string, fallbackIndex: number): void {
  const candidates = triggerCandidates()
  const labeled = candidates.find(button =>
    isSettingsTrigger(button.textContent ?? '', button.getAttribute('aria-label')))
  if (labeled !== undefined) {
    labeled.click()
    clickNav(targetLabel, fallbackIndex, 1)
    return
  }
  const first = candidates[0]
  if (first !== undefined) probe(first, candidates.slice(1), targetLabel, fallbackIndex, 1)
}
