import { ArrowDown, ArrowUp, Table2 } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { ListViewMode } from '@/core/list/listViewMode';
import { cn } from '@/lib/utils';

type ColumnCount = 1 | 2 | 3;

const COLUMN_OPTIONS: ColumnCount[] = [1, 2, 3];

export type ListColumnLayoutToggleProps = {
  columnCount: ColumnCount;
  listViewMode: ListViewMode;
  onSelectColumns: (count: ColumnCount) => void;
  onSelectTable: () => void;
  columnAriaLabel: (count: ColumnCount) => string;
  tableAriaLabel: string;
};

/**
 * Segmented control: 1 | 2 | 3 | table.
 * Selecting 1/2/3 implies cards layout; table is a separate listViewMode.
 */
export function ListColumnLayoutToggle({
  columnCount,
  listViewMode,
  onSelectColumns,
  onSelectTable,
  columnAriaLabel,
  tableAriaLabel,
}: ListColumnLayoutToggleProps) {
  const isTableView = listViewMode === 'table';

  return (
    <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
      {COLUMN_OPTIONS.map((count) => (
        <Button
          key={count}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 min-w-7 rounded-[6px] px-2 text-xs',
            !isTableView && columnCount === count
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onSelectColumns(count)}
          aria-label={columnAriaLabel(count)}
          aria-pressed={!isTableView && columnCount === count}
        >
          {count}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={Table2}
        className={cn(
          'h-7 min-w-7 rounded-[6px] px-2 text-xs',
          isTableView
            ? 'bg-background text-foreground shadow-sm hover:bg-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={onSelectTable}
        aria-label={tableAriaLabel}
        aria-pressed={isTableView}
        title={tableAriaLabel}
      />
    </div>
  );
}

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
