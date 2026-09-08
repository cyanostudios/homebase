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
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';
import { formatDate } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import { filesApi } from '../api/filesApi';
import type { FileItem } from '../types/files';
import type { FileColumnCount } from '../utils/fileColumnCount';
import { getMimeLabel, humanSize } from '../utils/humanSize';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

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
  columnCount?: FileColumnCount;
}) {
  const { t } = useTranslation();
  const isImage =
    String(file.mimeType ?? '').startsWith('image/') &&
    String(file.mimeType ?? '') !== 'image/svg+xml';
  const mimeLabel = getMimeLabel(file.mimeType);
  const sizeLabel = humanSize(file.size);
  const sizeDisplay = sizeLabel === '—' ? null : sizeLabel;
  const updatedLabel = file.updatedAt ? formatDate(file.updatedAt) : null;
  const metaOnTop = columnCount === 1;
  const hasMeta = Boolean(sizeDisplay || updatedLabel);
  const thumbUrl = file.id ? filesApi.getFileDownloadUrl(file.id, { inline: true }) : null;

  const metaRow = hasMeta ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {sizeDisplay ? <span className="truncate">{sizeDisplay}</span> : null}
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
      aria-label={t('files.openFile', { name: file.name })}
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

        {isImage && thumbUrl ? (
          <div className="overflow-hidden rounded-md bg-muted/30">
            <img
              src={thumbUrl}
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
