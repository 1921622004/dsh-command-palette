/**
 * One display-order source for the palette list: search results keep their
 * ranking order verbatim so the highlighted index, Enter, and the rendered
 * sequence name the same row; the empty-query home keeps the grouped browse
 * layout. Pure.
 */
import type { PaletteEntry } from './contract.ts'

/** Group rendering order for the empty-query home. */
export const GROUP_ORDER: readonly PaletteEntry['group'][] = ['session', 'sidebar', 'settings', 'action', 'extension']

/** One output element: a group header, a row, or both. */
export interface DisplayCell<Row> {
  /** Group header to render before this row; `undefined` renders none. */
  readonly header: PaletteEntry['group'] | undefined
  readonly row: Row
  /** Display index; equals the row's position among all rendered rows. */
  readonly index: number
}

/**
 * Flatten rows for rendering. While searching (`query !== ''`), the ranking
 * order passes through untouched and headers appear whenever the group
 * changes. Otherwise rows are re-sorted into group order for the browse home.
 * @param rows - ranked rows, as produced by the list memo.
 * @param query - current search text.
 * @returns one cell per row, in render order; `cells[i].index === i`.
 */
export function flattenRows<Row>(rows: readonly Row[], query: string, groupOf: (row: Row) => PaletteEntry['group']): readonly DisplayCell<Row>[] {
  if (query !== '') {
    let last: PaletteEntry['group'] | undefined
    return rows.map((row, index) => {
      const group = groupOf(row)
      const header = group === last ? undefined : group
      last = group
      return { header, row, index }
    })
  }
  let index = 0
  return GROUP_ORDER.flatMap(group => {
    const list = rows.filter(row => groupOf(row) === group)
    if (list.length === 0) return []
    return [
      { header: group as PaletteEntry['group'], row: list[0]!, index: index++ },
      ...list.slice(1).map(row => ({ header: undefined, row, index: index++ })),
    ]
  })
}
