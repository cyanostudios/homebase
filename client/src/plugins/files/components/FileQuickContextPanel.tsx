import { File as FileIcon, Info } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { QuickContextSection } from '@/core/ui/QuickContextSection';
import { cn } from '@/lib/utils';

import type { FileItem } from '../types/files';
import { humanSize } from '../utils/humanSize';

import { FileDetailHeaderMenus } from './FileDetailHeaderMenus';

export function FileQuickContextPanel({ file }: { file: FileItem }) {
  const { t } = useTranslation();

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.file')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={FileIcon}
          className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {file.name || '—'}
      </h3>
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className="border-b border-border/50 px-4 py-3">
        <FileDetailHeaderMenus file={file} leading={titleLeading} />
      </div>

      <div className="min-w-0 space-y-4 overflow-x-hidden px-4 py-4">
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
      </div>
    </Card>
  );
}
