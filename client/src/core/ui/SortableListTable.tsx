import React from 'react';

import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListTableSortIcon } from '@/core/ui/ListColumnLayoutToggle';
import { cn } from '@/lib/utils';

export type SortableListTableColumn<TRow, TField extends string> = {
  field: TField;
  header: React.ReactNode;
  className?: string;
  sortable?: boolean;
  cell: (row: TRow, index: number) => React.ReactNode;
};

export type SortableListTableSelection = {
  isSelected: (id: string) => boolean;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  selectAllAriaLabel: string;
  selectRowAriaLabel: (selected: boolean) => string;
};

export type SortableListTableProps<TRow, TField extends string> = {
  rows: TRow[];
  columns: SortableListTableColumn<TRow, TField>[];
  getRowId: (row: TRow) => string;
  primarySort: TField;
  sortOrder: 'asc' | 'desc';
  onSort: (field: TField) => void;
  onRowClick?: (row: TRow) => void;
  rowAriaLabel?: (row: TRow) => string;
  rowClassName?: (row: TRow) => string | undefined;
  isRowActive?: (row: TRow) => boolean;
  selection?: SortableListTableSelection;
  pluginName?: string;
  /** When set, serializes row into data-list-item (existing list pattern). */
  dataListItem?: (row: TRow) => unknown;
};

export function SortableListTable<TRow, TField extends string>({
  rows,
  columns,
  getRowId,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  rowAriaLabel,
  rowClassName,
  isRowActive,
  selection,
  pluginName,
  dataListItem,
}: SortableListTableProps<TRow, TField>) {
  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
      <Table rowBorders={false}>
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            {selection ? (
              <TableHead className="w-8 px-3 pr-1">
                <input
                  type="checkbox"
                  checked={selection.allVisibleSelected}
                  onChange={selection.onHeaderCheckboxChange}
                  className="h-4 w-4 cursor-pointer align-middle"
                  aria-label={selection.selectAllAriaLabel}
                />
              </TableHead>
            ) : null}
            {columns.map((col) => {
              const sortable = col.sortable !== false;
              return (
                <TableHead
                  key={col.field}
                  className={cn(
                    'text-xs',
                    sortable && 'cursor-pointer select-none hover:bg-muted/50',
                    col.className,
                  )}
                  onClick={sortable ? () => onSort(col.field) : undefined}
                  aria-sort={
                    sortable && primarySort === col.field
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : sortable
                        ? 'none'
                        : undefined
                  }
                >
                  <div className="flex items-center gap-2 leading-4">
                    <span>{col.header}</span>
                    {sortable ? (
                      <ListTableSortIcon active={primarySort === col.field} order={sortOrder} />
                    ) : null}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const id = getRowId(row);
            const selected = selection ? selection.isSelected(id) : false;
            const active = isRowActive?.(row) ?? false;
            return (
              <TableRow
                key={id}
                className={cn(
                  onRowClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80',
                  selected && 'bg-plugin-subtle ring-1 border-plugin-subtle',
                  active && 'bg-primary/5 ring-1 ring-primary/40',
                  rowClassName?.(row),
                )}
                aria-current={active ? 'true' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                data-list-item={dataListItem ? JSON.stringify(dataListItem(row)) : undefined}
                data-plugin-name={pluginName}
                role={onRowClick ? 'button' : undefined}
                aria-label={rowAriaLabel?.(row)}
              >
                {selection ? (
                  <TableCell className="w-8 px-3 py-4 pr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onMouseDown={(e) => selection.onCheckboxMouseDown(e, index)}
                      onChange={() => selection.onCheckboxChange(id)}
                      onClick={(e) => e.stopPropagation()}
                      className="relative -top-[2px] h-4 w-4 cursor-pointer align-middle"
                      aria-label={selection.selectRowAriaLabel(selected)}
                    />
                  </TableCell>
                ) : null}
                {columns.map((col, colIndex) => {
                  const isFirstDataCol = Boolean(selection) && colIndex === 0;
                  return (
                    <TableCell
                      key={col.field}
                      className={cn(isFirstDataCol && 'pl-2', col.className)}
                    >
                      {col.cell(row, index)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
