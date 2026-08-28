import { ArrowDown, ArrowUp, LayoutGrid, Table2 } from 'lucide-react';
import React from 'react';

import type { ListViewMode } from '@/core/list/listViewMode';
import {
  LIST_LAYOUT_TOGGLE_DIVIDER_CLASS,
  LIST_LAYOUT_TOGGLE_SHELL_CLASS,
} from '@/core/ui/pluginPageStyles';
import { useViewportTier } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type ColumnCount = 1 | 2 | 3;

export type ListColumnLayoutToggleProps = {
  columnCount: ColumnCount;
  listViewMode: ListViewMode;
  onSelectColumns: (count: ColumnCount) => void;
  onSelectTable: () => void;
  columnAriaLabel: (count: ColumnCount) => string;
  tableAriaLabel: string;
};

const halfBaseClass = cn(
  'inline-flex h-11 w-11 items-center justify-center',
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  '[&_svg]:size-5',
);

/**
 * Split button: cards (grid) | table — one shared pill on desktop; hidden on pad/phone.
 * Selecting cards always calls `onSelectColumns(3)`. See ADR VIEWPORT_TIER_PAD_SPLIT.
 */
export function ListColumnLayoutToggle({
  columnCount,
  listViewMode,
  onSelectColumns,
  onSelectTable,
  columnAriaLabel,
  tableAriaLabel,
}: ListColumnLayoutToggleProps) {
  const tier = useViewportTier();
  const isTableView = listViewMode === 'table';

  if (tier !== 'desktop') {
    return null;
  }

  const cardsSelected = !isTableView && columnCount === 3;

  return (
    <div role="group" aria-label={tableAriaLabel} className={LIST_LAYOUT_TOGGLE_SHELL_CLASS}>
      <button
        type="button"
        className={cn(
          halfBaseClass,
          'rounded-l-full hover:bg-primary/10',
          cardsSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary',
        )}
        onClick={() => onSelectColumns(3)}
        aria-label={columnAriaLabel(3)}
        aria-pressed={cardsSelected}
        title={columnAriaLabel(3)}
      >
        <LayoutGrid aria-hidden />
      </button>
      <span className={LIST_LAYOUT_TOGGLE_DIVIDER_CLASS} aria-hidden />
      <button
        type="button"
        className={cn(
          halfBaseClass,
          'rounded-r-full hover:bg-primary/10',
          isTableView ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary',
        )}
        onClick={onSelectTable}
        aria-label={tableAriaLabel}
        aria-pressed={isTableView}
        title={tableAriaLabel}
      >
        <Table2 aria-hidden />
      </button>
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
