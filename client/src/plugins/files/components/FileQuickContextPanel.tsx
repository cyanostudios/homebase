import { Download, ExternalLink, File as FileIcon, Info, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { QuickContextHeaderActions } from '@/core/ui/QuickContextHeaderActions';
import { QuickContextSection } from '@/core/ui/QuickContextSection';
import { cn } from '@/lib/utils';

import { filesApi } from '../api/filesApi';
import { useFiles } from '../hooks/useFiles';
import type { FileItem } from '../types/files';
import { humanSize } from '../utils/humanSize';

/** Preview box sized for list quick-context column (not full-panel height). */
const PREVIEW_FRAME_CLASS =
  'flex max-h-56 min-h-[8rem] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30';

function fileInitials(name: string): string {
  const base = name.trim().replace(/\.[^.]+$/, '');
  const parts = base.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase() || '—';
}

function isRasterImageMime(mimeType: string | null | undefined): boolean {
  const mt = String(mimeType ?? '').toLowerCase();
  return mt.startsWith('image/') && mt !== 'image/svg+xml';
}

function isPdfMime(mimeType: string | null | undefined): boolean {
  return String(mimeType ?? '').toLowerCase() === 'application/pdf';
}

export function FileQuickContextPanel({
  file,
  onClose,
  onEdit,
}: {
  file: FileItem;
  onClose?: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { deleteFile, getDeleteMessage } = useFiles();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isImage = isRasterImageMime(file.mimeType);
  const isPdf = isPdfMime(file.mimeType);
  const previewUrl = file.id ? filesApi.getFileDownloadUrl(file.id, { inline: true }) : null;
  const downloadUrl = file.id ? filesApi.getFileDownloadUrl(file.id) : null;

  const externalUrl = useMemo(() => {
    const u = file.url;
    if (!u) {
      return null;
    }
    if (u.startsWith('/api/files/')) {
      return null;
    }
    return u;
  }, [file.url]);

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        aria-hidden
      >
        {isImage && previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          fileInitials(file.name || '')
        )}
      </div>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1')}>{file.name || '—'}</h3>
      <QuickContextHeaderActions
        onEdit={onEdit}
        onClose={onClose}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  const previewBlock = useMemo(() => {
    if (isImage && previewUrl) {
      return (
        <div className={PREVIEW_FRAME_CLASS}>
          <img
            src={previewUrl}
            alt={file.name || ''}
            className="max-h-56 w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      );
    }
    if (isPdf && previewUrl) {
      return (
        <div className={cn(PREVIEW_FRAME_CLASS, 'p-0')}>
          <iframe src={previewUrl} title={file.name || 'pdf'} className="h-56 w-full border-0" />
        </div>
      );
    }
    return (
      <div className={PREVIEW_FRAME_CLASS}>
        <FileIcon className="h-10 w-10 text-muted-foreground" aria-hidden />
      </div>
    );
  }, [file.name, isImage, isPdf, previewUrl]);

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="border-b border-border/50 px-4 py-3">{identityHeader}</div>

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 py-4">
        {previewBlock}

        <QuickContextSection title={t('files.detailsTitle')} icon={Info} iconPlugin="files">
          <div className="space-y-4 text-xs">
            <div className="group flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('files.viewType')}</span>
              <span className="max-w-[150px] truncate font-medium">
                {file.mimeType || 'application/octet-stream'}
              </span>
            </div>
            <div className="group flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('files.viewSize')}</span>
              <span className="font-medium">{humanSize(file.size)}</span>
            </div>
          </div>
        </QuickContextSection>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <RoundIconLabelButton
            type="button"
            icon={Trash2}
            label={t('common.delete')}
            variant="secondary"
            alwaysExpanded
            contentClassName="text-red-600 dark:text-red-400"
            onClick={() => setShowDeleteConfirm(true)}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {externalUrl ? (
              <RoundIconLabelButton
                type="button"
                icon={ExternalLink}
                label={t('files.viewOpenOriginal')}
                variant="soft"
                alwaysExpanded
                onClick={() => {
                  window.open(externalUrl, '_blank', 'noopener,noreferrer');
                }}
              />
            ) : null}
            {downloadUrl ? (
              <RoundIconLabelButton
                type="button"
                icon={Download}
                label={t('files.download')}
                variant="secondary"
                alwaysExpanded
                onClick={() => {
                  window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('files.deleteTitle')}
        message={getDeleteMessage(file)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          void (async () => {
            await deleteFile(file.id);
            setShowDeleteConfirm(false);
            onClose?.();
          })();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Card>
  );
}
