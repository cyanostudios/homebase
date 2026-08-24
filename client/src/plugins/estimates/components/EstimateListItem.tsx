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
import { ListSelectionCheckboxSlot } from '@/core/ui/ListSelectionCheckboxSlot';

import type { Estimate } from '../types/estimate';
import type { EstimateColumnCount } from '../utils/estimateColumnCount';

import { EstimateStatusSelect } from './EstimateStatusSelect';

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
  const itemCount = estimate.lineItems.length;

  const metaRow = (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground',
        !metaOnTop && 'mt-0.5 pt-0.5',
      )}
    >
      <span className="font-medium text-foreground">
        {typeof estimate.total === 'number' ? estimate.total.toFixed(2) : estimate.total}{' '}
        {estimate.currency}
      </span>
      <span>
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </span>
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
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ListSelectionCheckboxSlot>{checkbox}</ListSelectionCheckboxSlot>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatDisplayNumber('estimates', estimate.estimateNumber)}
            </span>
            {metaOnTop ? metaRow : null}
          </div>
          <div
            className="flex shrink-0 items-center justify-end"
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

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className={cn('line-clamp-1 min-w-0', DETAIL_LIST_ITEM_TITLE_CLASS)}>
            {estimate.contactName}
          </h3>
          {estimate.organizationNumber ? (
            <span className="truncate text-xs text-muted-foreground">
              Org: {estimate.organizationNumber}
            </span>
          ) : null}
        </div>

        {!metaOnTop ? metaRow : null}
      </div>
    </Card>
  );
}
