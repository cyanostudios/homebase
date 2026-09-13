import { ArrowDown, ArrowUp } from 'lucide-react';
import React from 'react';

/** Sort direction marker for `SortableListTable` column headers. */
export function ListTableSortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) {
    return null;
  }
  return order === 'asc' ? (
    <ArrowUp className="inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="inline h-3 w-3" aria-hidden />
  );
}
