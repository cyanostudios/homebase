import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import type { FileItem } from '../types/files';
import type { FileSortField, FileSortOrder } from '../utils/fileListSort';
import { getMimeLabel, humanSize } from '../utils/humanSize';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

export type FileListTableProps = {
  files: FileItem[];
  primarySort: FileSortField;
  sortOrder: FileSortOrder;
  onSort: (field: FileSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (file: FileItem) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  selectionEnabled?: boolean;
};

export function FileListTable({
  files,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  selectionEnabled = true,
}: FileListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<FileItem, FileSortField>[] => [
      {
        field: 'name',
        header: t('files.columnName'),
        cell: (file) => (
          <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
            {file.name}
          </span>
        ),
      },
      {
        field: 'mimeType',
        header: t('files.columnType'),
        cell: (file) => (
          <Badge
            className={cn(
              BADGE_CLASS,
              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {getMimeLabel(file.mimeType) || '—'}
          </Badge>
        ),
      },
      {
        field: 'size',
        header: t('files.columnSize'),
        className: 'hidden sm:table-cell',
        cell: (file) => (
          <span className="text-xs tabular-nums text-muted-foreground">{humanSize(file.size)}</span>
        ),
      },
    ],
    [t],
  );

  const selection: SortableListTableSelection | undefined = selectionEnabled
    ? {
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }
    : undefined;

  return (
    <SortableListTable
      rows={files}
      columns={columns}
      getRowId={(file) => String(file.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(file) => t('files.openFile', { name: file.name })}
      selection={selection}
      pluginName="files"
      dataListItem={(file) => file}
    />
  );
}
