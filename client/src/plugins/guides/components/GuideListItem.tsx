import { MapPin } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { Guide } from '../types/guides';
import { GUIDE_LIFECYCLE_COLORS } from '../types/guides';
import type { GuideColumnCount } from '../utils/guideColumnCount';

import { GuideLanguageBadges } from './GuideLanguageBadges';

export function GuideListItem({
  guide,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  guide: Guide;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  /** When 1, meta sits on the top row; 2/3 keep meta below title/excerpt. */
  columnCount?: GuideColumnCount;
}) {
  const { t } = useTranslation();
  const placeLabel =
    guide.place?.displayName || guide.place?.locality || guide.geographicReference || null;
  const updatedLabel = guide.updatedAt ? formatDate(guide.updatedAt) : null;
  const metaOnTop = columnCount === 1;

  const metaRow = updatedLabel ? (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="truncate">
        {t('common.updated')}: {updatedLabel}
      </span>
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
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(guide)}
      data-plugin-name="guides"
      role="button"
      tabIndex={0}
      aria-label={t('guides.openPlace', { name: guide.displayName })}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            <Badge className={GUIDE_LIFECYCLE_COLORS[guide.lifecycleStatus]}>
              {t(`guides.lifecycle.${guide.lifecycleStatus}`)}
            </Badge>
            {metaOnTop ? metaRow : null}
          </div>
        </div>

        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{guide.displayName}</h3>

        {placeLabel ? (
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{placeLabel}</span>
          </div>
        ) : null}

        <GuideLanguageBadges
          languages={guide.languages ?? []}
          sourceLanguage={guide.sourceLanguage}
        />

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
