import { ExternalLink, File, FileText, Image as ImageIcon } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';

import { filesApi } from '../api/filesApi';
import type { FileItem } from '../types/files';
import { humanSize } from '../utils/humanSize';

import { FileQuickContextPanel } from './FileQuickContextPanel';

type Props = {
  file?: FileItem;
  item?: FileItem;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
};

export const FileView: React.FC<Props> = ({ file, item, stacked = false }) => {
  const { t } = useTranslation();
  const f = (file ?? item) as FileItem | undefined;

  const previewUrl = useMemo(() => {
    if (!f?.id) {
      return null;
    }
    return filesApi.getFileDownloadUrl(f.id, { inline: true });
  }, [f?.id]);

  const externalUrl = useMemo(() => {
    const u = f?.url;
    if (!u) {
      return null;
    }
    if (u.startsWith('/api/files/')) {
      return null;
    }
    return u;
  }, [f?.url]);

  const isImage = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt.startsWith('image/') && mt !== 'image/svg+xml';
  }, [f?.mimeType]);

  const isPdf = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt === 'application/pdf';
  }, [f?.mimeType]);

  if (!f) {
    return (
      <div className="plugin-files flex flex-col items-center justify-center p-12 text-muted-foreground opacity-50">
        <File className="mb-4 h-12 w-12" />
        <p className="text-sm font-medium">{t('files.viewNoSelection')}</p>
      </div>
    );
  }

  const previewSection = (
    <div className="space-y-4">
      {previewUrl ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={
              isImage
                ? t('files.previewImage')
                : isPdf
                  ? t('files.previewPdf')
                  : t('files.previewContent')
            }
            iconPlugin="files"
            subtleTitle
            className="p-6"
          >
            {isImage ? (
              <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-inner">
                <img src={previewUrl} alt={f.name || 'image'} className="h-auto max-w-full" />
              </div>
            ) : isPdf ? (
              <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-inner">
                <iframe
                  src={previewUrl}
                  title={f.name || 'pdf'}
                  className="w-full"
                  style={{ minHeight: 600 }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-60">
                <FileText className="mb-4 h-12 w-12" />
                <p className="text-sm">{t('files.previewNoInline')}</p>
              </div>
            )}
          </DetailSection>
        </Card>
      ) : (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('files.previewUnavailableTitle')}
            iconPlugin="files"
            subtleTitle
            className="p-6"
          >
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground opacity-60">
              <ImageIcon className="mb-4 h-12 w-12" />
              <p className="text-sm">{t('files.previewNoUrl')}</p>
            </div>
          </DetailSection>
        </Card>
      )}
    </div>
  );

  if (stacked) {
    return (
      <DetailLayout gridClassName="grid-cols-1" leftSidebar={<FileQuickContextPanel file={f} />}>
        {previewSection}
      </DetailLayout>
    );
  }

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-4">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('files.detailsTitle')}
              iconPlugin="files"
              subtleTitle
              className="p-4"
              collapsible
            >
              <div className="space-y-4 text-xs">
                <div className="group flex items-center justify-between">
                  <span className="text-muted-foreground">{t('files.viewType')}</span>
                  <span className="max-w-[150px] truncate font-medium">
                    {f.mimeType || 'application/octet-stream'}
                  </span>
                </div>
                <div className="group flex items-center justify-between">
                  <span className="text-muted-foreground">{t('files.viewSize')}</span>
                  <span className="font-medium">{humanSize(f.size)}</span>
                </div>
                {externalUrl ? (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-muted-foreground">{t('files.openExternally')}</span>
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 break-all font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {t('files.viewOpenOriginal')}
                    </a>
                  </div>
                ) : null}
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      {previewSection}
    </DetailLayout>
  );
};
