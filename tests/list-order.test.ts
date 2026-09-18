/** flattenRows: search keeps ranking order verbatim; the home keeps group layout. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { flattenRows } from '../src/client/list-order.ts'

interface Row {
  readonly id: string
  readonly group: string
}

const rows: readonly Row[] = [
  { id: 'a', group: 'action' },
  { id: 'b', group: 'extension' },
  { id: 'c', group: 'sidebar' },
  { id: 'd', group: 'sidebar' },
]
const groupOf = (row: Row) => row.group as never

test('search mode preserves ranking order and inserts a header on group change', () => {
  const cells = flattenRows(rows, 'ar', groupOf)
  assert.deepEqual(cells.map(cell => cell.row.id), ['a', 'b', 'c', 'd'])
  assert.deepEqual(
    cells.map(cell => cell.header),
    ['action', 'extension', 'sidebar', undefined],
  )
  assert.deepEqual(cells.map(cell => cell.index), [0, 1, 2, 3])
})

test('home mode reorders rows into group order with one header per group', () => {
  const cells = flattenRows(rows, '', groupOf)
  assert.deepEqual(cells.map(cell => cell.row.id), ['c', 'd', 'a', 'b'])
  assert.deepEqual(
    cells.map(cell => cell.header),
    ['sidebar', undefined, 'action', 'extension'],
  )
  assert.deepEqual(cells.map(cell => cell.index), [0, 1, 2, 3])
})

test('groups absent from rows render no header', () => {
  const single: readonly Row[] = [{ id: 'x', group: 'extension' }]
  const cells = flattenRows(single, '', groupOf)
  assert.deepEqual(cells.map(cell => cell.header), ['extension'])
})
