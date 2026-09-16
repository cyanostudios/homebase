import { File as FileIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import { filesApi } from '../api/filesApi';
import type { FileItem } from '../types/files';
import { getMimeLabel, humanSize } from '../utils/humanSize';

function isRasterImageMime(mimeType: string | null | undefined): boolean {
  const mt = String(mimeType ?? '').toLowerCase();
  return mt.startsWith('image/') && mt !== 'image/svg+xml';
}

export function fileIdentityMeta(
  file: FileItem,
  options?: { includeCreatedAt?: boolean },
): string | null {
  const parts: string[] = [];
  const typeLabel = getMimeLabel(file.mimeType)?.trim();
  if (typeLabel) {
    parts.push(typeLabel);
  }
  const sizeLabel = humanSize(file.size);
  if (sizeLabel && sizeLabel !== '—') {
    parts.push(sizeLabel);
  }
  if (options?.includeCreatedAt !== false) {
    const createdLabel = formatDateTimeShort(file.createdAt);
    if (createdLabel) {
      parts.push(createdLabel);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Shared file identity row used by Files list (name column) and attachment lists.
 * Thumbnail or type icon + bold name + muted type/size/(created) meta.
 */
export function FileIdentityCell({
  file,
  includeCreatedAt = true,
  className,
  titleClassName,
}: {
  file: FileItem;
  includeCreatedAt?: boolean;
  className?: string;
  /** Override name text styles (e.g. drop row-hover primary when not in a table). */
  titleClassName?: string;
}) {
  const { t } = useTranslation();
  const isImage = isRasterImageMime(file.mimeType);
  const thumbUrl = file.id ? filesApi.getFileDownloadUrl(file.id, { inline: true }) : null;
  const identityMeta = fileIdentityMeta(file, { includeCreatedAt });
  const displayName = file.name?.trim() ? file.name : file.id || '—';

  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {isImage && thumbUrl ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40">
            <img
              src={thumbUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </span>
        ) : (
          <span title={t('nav.file')} className="inline-flex shrink-0">
            <SectionCategoryIcon
              icon={FileIcon}
              className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3.5 [&_svg]:w-3.5"
            />
          </span>
        )}
        <span
          className={cn(
            'min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary',
            titleClassName,
          )}
          title={displayName}
        >
          {displayName}
        </span>
      </div>
      {identityMeta ? (
        <span className="min-w-0 truncate pl-[2.625rem] text-[10px] font-normal leading-tight tabular-nums text-slate-400 dark:text-slate-500">
          {identityMeta}
        </span>
      ) : null}
    </div>
  );
}
