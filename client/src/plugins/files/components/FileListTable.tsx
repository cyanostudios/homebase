import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';

import type { FileItem } from '../types/files';
import type { FileSortField, FileSortOrder } from '../utils/fileListSort';

import { FileIdentityCell } from './FileIdentityCell';

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
  activeFileId?: string | number | null;
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
  activeFileId = null,
}: FileListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    (): SortableListTableColumn<FileItem, FileSortField>[] => [
      {
        field: 'name',
        header: t('files.columnName'),
        cell: (file) => <FileIdentityCell file={file} />,
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
      isRowActive={(file) => activeFileId != null && String(file.id) === String(activeFileId)}
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
    />
  );
}
