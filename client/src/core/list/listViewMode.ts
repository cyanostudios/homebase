/** Header-click sort: toggle order on same field, else switch field with plugin default order. */
export function nextListTableSort<TField extends string>(
  currentField: TField,
  currentOrder: 'asc' | 'desc',
  nextField: TField,
  isAscDefault: (field: TField) => boolean,
): { field: TField; order: 'asc' | 'desc' } {
  if (currentField === nextField) {
    return { field: currentField, order: currentOrder === 'asc' ? 'desc' : 'asc' };
  }
  return {
    field: nextField,
    order: isAscDefault(nextField) ? 'asc' : 'desc',
  };
}
