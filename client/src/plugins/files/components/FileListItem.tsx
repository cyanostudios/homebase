import { File as FileIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { FileItem } from '../types/files';
import type { FileColumnCount } from '../utils/fileColumnCount';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

function humanSize(bytes?: number | null): string | null {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return null;
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getMimeLabel(mimeType?: string | null): string | null {
  if (!mimeType) {
    return null;
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
  return sub ? sub.toUpperCase() : null;
}

export function FileListItem({
  file,
  selected,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  file: FileItem;
  selected?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, meta sits on the top row; 2/3 keep meta below title. */
  columnCount?: FileColumnCount;
}) {
  const { t } = useTranslation();
  const isImage = String(file.mimeType ?? '').startsWith('image/');
  const mimeLabel = getMimeLabel(file.mimeType);
  const sizeLabel = humanSize(file.size);
  const updatedLabel = file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : null;
  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(sizeLabel || updatedLabel);

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {sizeLabel ? <span className="truncate">{sizeLabel}</span> : null}
      {updatedLabel ? (
        <span className="truncate">
          {t('common.updated')}: {updatedLabel}
        </span>
      ) : null}
    </div>
  ) : null;

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(file)}
      data-plugin-name="files"
      role="button"
      tabIndex={0}
      aria-label={`Open file ${file.name}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            {mimeLabel ? (
              <Badge
                variant="outline"
                className={cn(BADGE_CLASS, 'bg-muted text-muted-foreground')}
              >
                {mimeLabel}
              </Badge>
            ) : null}
            {metaOnTop ? metaRow : null}
          </div>
        </div>

        {isImage && file.url ? (
          <div className="overflow-hidden rounded-md bg-muted/30">
            <img
              src={file.url}
              alt={file.name}
              className="h-24 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex h-10 w-full items-center justify-center rounded-md bg-muted/20">
            <FileIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{file.name || '—'}</h3>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
