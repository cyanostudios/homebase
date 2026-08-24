import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { GarmentList } from '../types/garments';
import type { GarmentColumnCount } from '../utils/garmentColumnCount';

export function GarmentListItem({
  item,
  selected,
  highlighted,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  item: GarmentList;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  columnCount?: GarmentColumnCount;
}) {
  const { t } = useTranslation();
  const metaOnTop = columnCount === 1;
  const updatedLabel = formatDate(item.updatedAt) || null;
  const personCount = item.personCount ?? item.persons?.length ?? 0;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="truncate">{t('garments.personCount', { count: personCount })}</span>
      {updatedLabel ? <span className="truncate">{updatedLabel}</span> : null}
    </div>
  );

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
        highlighted && 'bg-green-50 dark:bg-green-950/30',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(item)}
      data-plugin-name="garments"
      role="button"
      tabIndex={0}
      aria-label={t('garments.openList', { name: item.name || item.id })}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            {metaOnTop ? metaRow : null}
          </div>
        </div>
        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>{item.name || '—'}</h3>
        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
