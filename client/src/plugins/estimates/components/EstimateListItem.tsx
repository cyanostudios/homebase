import { CalendarDays } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import {
  DETAIL_VIEW_CARD_CLASS,
  DETAIL_LIST_ITEM_HOVER_CLASS,
  DETAIL_LIST_ITEM_TITLE_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { ESTIMATE_STATUS_COLORS, formatEstimateStatusForDisplay } from '../types/estimate';
import type { Estimate } from '../types/estimate';
import type { EstimateColumnCount } from '../utils/estimateColumnCount';

import { EstimateStatusSelect } from './EstimateStatusSelect';

const BADGE_CLASS =
  'inline-flex items-center rounded-md border-0 px-2 py-0.5 text-xs font-semibold';

export function EstimateListItem({
  estimate,
  selected,
  highlighted,
  onClick,
  checkbox,
  onStatusChange,
  columnCount = 1,
}: {
  estimate: Estimate;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  onStatusChange: (status: string) => void;
  /** When 1, meta sits on the top row; 2/3 keep meta below title/excerpt. */
  columnCount?: EstimateColumnCount;
}) {
  const createdLabel = estimate.createdAt
    ? new Date(estimate.createdAt).toLocaleDateString()
    : null;
  const validToLabel = estimate.validTo ? new Date(estimate.validTo).toLocaleDateString() : null;
  const isExpired = estimate.validTo && new Date(estimate.validTo).getTime() < Date.now();
  const metaOnTop = columnCount === 1;

  const metaRow = (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {typeof estimate.total === 'number' ? estimate.total.toFixed(2) : estimate.total}{' '}
          {estimate.currency}
        </span>
        <span>
          {estimate.lineItems.length} item{estimate.lineItems.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {validToLabel ? (
          <span
            className={cn(
              'inline-flex min-w-0 items-center gap-1.5',
              isExpired && estimate.status !== 'accepted' && estimate.status !== 'rejected'
                ? 'text-destructive'
                : '',
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Valid to: {validToLabel}</span>
          </span>
        ) : null}
        {createdLabel ? <span className="truncate">Created: {createdLabel}</span> : null}
      </div>
    </>
  );

  const metaBlock = (
    <div className={cn('flex min-w-0 flex-col gap-1', !metaOnTop && 'mt-0.5 pt-0.5')}>
      {metaRow}
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
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : DETAIL_LIST_ITEM_HOVER_CLASS,
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input[type="checkbox"], button, [role="combobox"], [data-radix-collection-item]',
          )
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(estimate)}
      data-plugin-name="estimates"
      role="button"
      tabIndex={0}
      aria-label={`Open estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatDisplayNumber('estimates', estimate.estimateNumber)}
            </span>
            <span
              className={cn(
                BADGE_CLASS,
                ESTIMATE_STATUS_COLORS[estimate.status as keyof typeof ESTIMATE_STATUS_COLORS],
              )}
            >
              {formatEstimateStatusForDisplay(estimate.status)}
            </span>
            {metaOnTop ? metaBlock : null}
          </div>
          <div
            className="flex shrink-0 justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <EstimateStatusSelect
              estimate={estimate}
              onStatusChange={onStatusChange}
              hideInlineLabel
            />
          </div>
        </div>

        <h3 className={cn('line-clamp-1', DETAIL_LIST_ITEM_TITLE_CLASS)}>{estimate.contactName}</h3>

        {estimate.organizationNumber ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            Org: {estimate.organizationNumber}
          </p>
        ) : null}

        {!metaOnTop ? metaBlock : null}
      </div>
    </Card>
  );
}
