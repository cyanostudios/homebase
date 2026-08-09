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

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function humanSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getMimeLabel(mimeType?: string | null): string {
  if (!mimeType) {
    return '—';
  }
  if (mimeType.startsWith('image/')) {
    return mimeType.replace('image/', '').toUpperCase();
  }
  if (mimeType.includes('pdf')) {
    return 'PDF';
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return 'DOCX';
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return 'XLSX';
  }
  const sub = mimeType.split('/').pop();
  return sub ? sub.toUpperCase() : mimeType;
}

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
}: FileListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<FileItem, FileSortField>[] => [
      {
        field: 'name',
        header: t('files.columnName'),
        cell: (file) => <span className="font-medium text-foreground">{file.name}</span>,
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
            {getMimeLabel(file.mimeType)}
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
      {
        field: 'updatedAt',
        header: t('files.columnUpdated'),
        className: 'hidden md:table-cell',
        cell: (file) => (
          <span className="text-xs text-muted-foreground">
            {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  const selection: SortableListTableSelection = {
    isSelected,
    onCheckboxMouseDown,
    onCheckboxChange,
    allVisibleSelected,
    onHeaderCheckboxChange,
    selectAllAriaLabel: t('common.selectAllVisible'),
    selectRowAriaLabel: (selected) => (selected ? t('common.unselectRow') : t('common.selectRow')),
  };

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
