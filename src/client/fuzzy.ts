/**
 * Weighted fuzzy ranking over palette rows' display strings. Prefix beats
 * word-internal substring beats in-order subsequence; label beats detail
 * beats keywords. Pure; no locale knowledge.
 */

/** Weighted subsequence score of one text against the query; -1 means no match. */
function scoreText(text: string, query: string): number {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const prefix = lower.indexOf(q)
  if (prefix === 0) return 1000
  if (prefix > 0) return 600 - Math.min(prefix, 100)
  let ti = 0
  let gaps = 0
  for (const ch of q) {
    const found = lower.indexOf(ch, ti)
    if (found === -1) return -1
    gaps += found - ti
    ti = found + 1
  }
  return 300 - Math.min(gaps, 200)
}

/** Match target: the display strings one row contributes. */
export interface FuzzyItem {
  readonly label: string
  readonly detail?: string
  readonly keywords?: readonly string[]
}

/** Score one item across label/detail/keywords; higher is better. */
export function scoreItem(item: FuzzyItem, query: string): number {
  const label = scoreText(item.label, query)
  if (label >= 0) return label
  if (item.detail !== undefined) {
    const detail = scoreText(item.detail, query)
    if (detail >= 0) return detail - 200
  }
  for (const kw of item.keywords ?? []) {
    const s = scoreText(kw, query)
    if (s >= 0) return s - 300
  }
  return -1
}

/** Sort items by score desc with a stable label tiebreak; non-matches drop. */
export function rankItems<T extends FuzzyItem>(items: readonly T[], query: string): T[] {
  return items
    .map(item => ({ item, score: scoreItem(item, query) }))
    .filter(scored => scored.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .map(scored => scored.item)
}
