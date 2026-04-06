import { ExternalLink, File, FileText, Image as ImageIcon, Info } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import type { FileItem } from '../types/files';

type Props = {
  file?: FileItem;
  item?: FileItem;
};

const FILE_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

function humanSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
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

export const FileView: React.FC<Props> = ({ file, item }) => {
  const { t } = useTranslation();
  const f = (file ?? item) as FileItem | undefined;

  const isImage = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt.startsWith('image/');
  }, [f?.mimeType]);

  const isPdf = useMemo(() => {
    const mt = (f?.mimeType || '').toLowerCase();
    return mt === 'application/pdf' || (f?.url || '').toLowerCase().endsWith('.pdf');
  }, [f?.mimeType, f?.url]);

  if (!f) {
    return (
      <div className="plugin-files flex flex-col items-center justify-center p-12 text-muted-foreground opacity-50">
        <File className="mb-4 h-12 w-12" />
        <p className="text-sm font-medium">{t('files.viewNoSelection')}</p>
      </div>
    );
  }

  return (
    <div className="plugin-files min-h-full bg-background p-4 md:p-6">
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={FILE_DETAIL_CARD_CLASS}>
              <DetailSection
                title={t('files.viewInformation')}
                icon={Info}
                iconPlugin="files"
                className="p-4"
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
                  {f.url && (
                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-muted-foreground">{t('files.viewSourceUrl')}</span>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 break-all font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {t('files.viewOpenOriginal')}
                      </a>
                    </div>
                  )}
                  <div className="mt-2 border-t border-border/50 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('files.viewId')}</span>
                      <span className="font-mono font-medium opacity-70">
                        {formatDisplayNumber('files', f.id)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">{t('files.viewCreated')}</span>
                      <span className="font-mono text-[10px] font-medium opacity-70">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">{t('files.viewUpdated')}</span>
                      <span className="font-mono text-[10px] font-medium opacity-70">
                        {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-4">
          {f.url ? (
            <Card padding="none" className={FILE_DETAIL_CARD_CLASS}>
              <DetailSection
                title={
                  isImage
                    ? t('files.previewImage')
                    : isPdf
                      ? t('files.previewPdf')
                      : t('files.previewContent')
                }
                iconPlugin="files"
                className="p-6"
              >
                {isImage ? (
                  <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-inner">
                    <img src={f.url} alt={f.name || 'image'} className="h-auto max-w-full" />
                  </div>
                ) : isPdf ? (
                  <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-inner">
                    <iframe
                      src={f.url}
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
            <Card padding="none" className={FILE_DETAIL_CARD_CLASS}>
              <DetailSection
                title={t('files.previewUnavailableTitle')}
                iconPlugin="files"
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
      </DetailLayout>
    </div>
  );
};
