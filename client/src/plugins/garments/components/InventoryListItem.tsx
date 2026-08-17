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

import type { InventoryItem } from '../types/garments';
import type { GarmentColumnCount } from '../utils/garmentColumnCount';

export function InventoryListItem({
  item,
  selected,
  onClick,
  checkbox,
  columnCount = 1,
}: {
  item: InventoryItem;
  selected?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  columnCount?: GarmentColumnCount;
}) {
  const { t } = useTranslation();
  const metaOnTop = columnCount === 1;
  const updatedLabel = formatDate(item.updatedAt) || null;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      {[item.brand, item.size, t('garments.qty', { count: item.quantity })]
        .filter(Boolean)
        .map((part) => (
          <span key={String(part)} className="truncate">
            {part}
          </span>
        ))}
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
      aria-label={t('garments.openInventory', { name: item.articleName || item.id })}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            {metaOnTop ? metaRow : null}
          </div>
        </div>
        <h3 className={cn('line-clamp-2', DETAIL_LIST_ITEM_TITLE_CLASS)}>
          {item.articleName || '—'}
        </h3>
        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
