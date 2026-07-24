import { File as FileIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { FileItem } from '../types/files';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

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
}: {
  file: FileItem;
  selected?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const isImage = String(file.mimeType ?? '').startsWith('image/');
  const mimeLabel = getMimeLabel(file.mimeType);
  const sizeLabel = humanSize(file.size);
  const updatedLabel = file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : null;

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
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
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
            {checkbox}
            {mimeLabel ? (
              <Badge
                variant="outline"
                className={cn(BADGE_CLASS, 'bg-muted text-muted-foreground')}
              >
                {mimeLabel}
              </Badge>
            ) : null}
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

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {file.name || '—'}
        </h3>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {sizeLabel ? <span className="truncate">{sizeLabel}</span> : null}
          {updatedLabel ? (
            <span className="truncate">
              {t('common.updated')}: {updatedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
