import { File as FileIcon } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

import { Badge } from '@/components/ui/badge';
import {
  SortableListTable,
  type SortableListTableColumn,
  type SortableListTableSelection,
} from '@/core/ui/SortableListTable';
import { cn } from '@/lib/utils';

import { filesApi } from '../api/filesApi';
import type { FileItem } from '../types/files';
import type { FileSortField, FileSortOrder } from '../utils/fileListSort';
import { getMimeLabel, humanSize } from '../utils/humanSize';

function isRasterImageMime(mimeType: string | null | undefined): boolean {
  const mt = String(mimeType ?? '').toLowerCase();
  return mt.startsWith('image/') && mt !== 'image/svg+xml';
}

function FileNameCell({ file }: { file: FileItem }) {
  const isImage = isRasterImageMime(file.mimeType);
  const thumbUrl = file.id ? filesApi.getFileDownloadUrl(file.id, { inline: true }) : null;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <FileIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="truncate font-extrabold text-foreground transition-colors group-hover:text-primary">
        {file.name}
      </span>
    </span>
  );
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
        cell: (file) => <FileNameCell file={file} />,
      },
      {
        field: 'mimeType',
        header: t('files.columnType'),
        cell: (file) => (
          <Badge
            className={cn(
              BADGE_CHIP_CLASS,
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
      isRowActive={(file) => activeFileId != null && String(file.id) === String(activeFileId)}
    />
  );
}
