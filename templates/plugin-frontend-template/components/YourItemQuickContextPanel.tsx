/**
 * Quick context panel — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md §1
 * and client/src/plugins/contacts/components/ContactQuickContextPanel.tsx.
 */
import { FileText, Hash } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { YourItem } from '../types/your-items';

import { YourItemDetailHeaderMenus } from './YourItemDetailHeaderMenus';

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

const LIST_CONTENT_PREVIEW_CHARS = 1200;

function truncatePlainText(
  content: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  const plain = content.trim();
  if (!plain) {
    return { text: '', truncated: false };
  }
  if (plain.length <= maxChars) {
    return { text: plain, truncated: false };
  }
  const slice = plain.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return { text: `${plain.slice(0, cut).trimEnd()}…`, truncated: true };
}

export function YourItemQuickContextPanel({
  item,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
  selectionMode = false,
  headerBelow = null,
}: {
  item: YourItem;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = preview beside the list; `full` = header column in full detail view. */
  variant?: 'list' | 'full';
  /** When true, header Open uses soft primary (bulk select active). */
  selectionMode?: boolean;
  /** Optional row under the title (e.g. EXAMPLE tab chips), same slot as Teams. */
  headerBelow?: React.ReactNode;
}) {
  const isFullView = variant === 'full';
  const { t } = useTranslation();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [item.id]);

  const descriptionPreview = useMemo(() => {
    if (!item.description) {
      return { text: '', truncated: false };
    }
    return truncatePlainText(item.description, LIST_CONTENT_PREVIEW_CHARS);
  }, [item.description]);

  const displayedDescription = descriptionExpanded
    ? item.description?.trim() || ''
    : descriptionPreview.text;
  const showReadMoreToggle = descriptionPreview.truncated && !isFullView;

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title="Item" className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={FileText}
          className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {item.title || '—'}
      </h3>
    </div>
  );

  const identityHeader = isFullView ? (
    <YourItemDetailHeaderMenus key={item.id} item={item} leading={titleLeading} />
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0 flex-1">{titleLeading}</div>
      <QuickContextHeaderActions
        onOpen={onOpenFullProfile}
        onEdit={onEdit}
        onClose={onClose}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
        openVariant={selectionMode ? 'soft' : 'primary'}
      />
    </div>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className={cn('px-4 py-5', !isFullView && 'border-b border-border/50')}>
        {identityHeader}
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>

      {!isFullView ? (
        <div className="space-y-6 px-4 py-4">
          {item.updatedAt ? (
            <p className="text-xs text-muted-foreground">
              {t('common.updated')}: {formatDate(item.updatedAt)}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Hash className="h-3 w-3" />
                ID
              </div>
              <div className={DETAIL_FIELD_VALUE_CLASS}>
                {formatDisplayNumber('your-items', item.id)}
              </div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>{t('common.created')}</div>
              <div className={DETAIL_FIELD_VALUE_CLASS}>{formatDate(item.createdAt)}</div>
            </div>
          </div>

          {item.description ? (
            <div>
              <div className={FACT_LABEL_CLASS}>Description</div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{displayedDescription}</p>
              {showReadMoreToggle ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2 text-xs text-primary"
                  onClick={() => setDescriptionExpanded((prev) => !prev)}
                >
                  {descriptionExpanded ? t('common.showLess') : t('common.readMore')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isFullView && onOpenFullProfile ? (
        <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
      ) : null}
    </Card>
  );
}
