import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { Instruction } from '../types/instructions';
import type { InstructionSortField, InstructionSortOrder } from '../utils/instructionListSort';

export type InstructionListTableProps = {
  instructions: Instruction[];
  primarySort: InstructionSortField;
  sortOrder: InstructionSortOrder;
  onSort: (field: InstructionSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (instruction: Instruction) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedInstructionId: string | null;
};

export function InstructionListTable({
  instructions,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedInstructionId,
}: InstructionListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<SortableListTableColumn<Instruction, InstructionSortField>[]>(
    () => [
      {
        field: 'title',
        header: t('instructions.sort.title'),
        cell: (row) => <span className="font-medium text-foreground">{row.title}</span>,
      },
      {
        field: 'publicationStatus',
        header: t('instructions.sort.status'),
        cell: (row) => {
          const isPublished = row.publicationStatus === 'published';
          return (
            <Badge
              variant={isPublished ? 'default' : 'secondary'}
              className={cn(
                'text-[10px] font-extrabold',
                isPublished &&
                  'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200',
              )}
            >
              {isPublished ? t('instructions.status.published') : t('instructions.status.draft')}
            </Badge>
          );
        },
      },
      {
        field: 'updatedAt',
        header: t('common.updated'),
        className: 'hidden sm:table-cell',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
      {
        field: 'createdAt',
        header: t('common.created'),
        className: 'hidden md:table-cell',
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={instructions}
      columns={columns}
      getRowId={(row) => String(row.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(row) => t('instructions.openInstruction', { title: row.title })}
      rowClassName={(row) =>
        recentlyDuplicatedInstructionId === String(row.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      pluginName="instructions"
      dataListItem={(row) => row}
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
    />
  );
}
