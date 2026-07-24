import { Bell, Eye, EyeOff, MapPin } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import type { Slot } from '../types/slots';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function formatDateTime(s: string | null) {
  return s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export function SlotListItem({
  slot,
  selected,
  highlighted,
  onClick,
  checkbox,
}: {
  slot: Slot;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const title = slot.name?.trim() || `SLT ${slot.id}`;
  const category = slot.category?.trim();
  const updatedLabel = slot.updated_at
    ? new Date(slot.updated_at).toLocaleDateString('sv-SE')
    : null;
  const assignedCount = (slot.mentions?.length ?? 0) + (slot.booked_count ?? 0);
  const timePast = isSlotTimePast(slot.slot_time);

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
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"], button')) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(slot)}
      data-plugin-name="slots"
      role="button"
      tabIndex={0}
      aria-label={`Open slot ${title}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            {category ? (
              <Badge
                variant="outline"
                className={cn(
                  BADGE_CLASS,
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {category}
              </Badge>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={t('common.visible')}>
              {slot.visible ? (
                <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">
                {t('common.visible')}: {slot.visible ? t('common.yes') : t('common.no')}
              </span>
            </span>
            <span className="inline-flex items-center gap-1" title={t('common.notifications')}>
              <Bell
                className={cn(
                  'h-3.5 w-3.5',
                  slot.notifications_enabled
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground/60',
                )}
              />
              <span className="sr-only">
                {t('common.notifications')}:{' '}
                {slot.notifications_enabled ? t('common.on') : t('common.off')}
              </span>
            </span>
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{title}</h3>

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{slot.location?.trim() || '—'}</span>
          </span>
          <span
            className={cn('truncate', timePast && 'font-medium text-red-600 dark:text-red-400')}
          >
            {formatDateTime(slot.slot_time)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span>
              {t('common.capacity')} {slot.capacity}
            </span>
            <CapacityAssignedDots capacity={slot.capacity} assignedCount={assignedCount} />
          </span>
          {updatedLabel ? (
            <span className="truncate">
              {t('common.updated')}: {updatedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
