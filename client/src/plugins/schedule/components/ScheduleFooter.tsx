import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { computeScheduleStats, type ScheduleSlot } from '../types/schedule';

export function ScheduleFooter({
  slots,
  availableHours,
}: {
  slots: ScheduleSlot[];
  availableHours?: number;
}) {
  const { t } = useTranslation();
  const stats = useMemo(() => computeScheduleStats(slots), [slots]);

  const hasCapacity = typeof availableHours === 'number' && Number.isFinite(availableHours);
  const availableMinutes = hasCapacity ? Math.round(availableHours * 60) : null;
  const overMinutes =
    availableMinutes != null ? Math.max(0, stats.totalMinutes - availableMinutes) : 0;
  const isOverbooked = overMinutes > 0;
  const remainingMinutes =
    availableMinutes != null ? Math.max(0, availableMinutes - stats.totalMinutes) : 0;

  const overHours = Math.floor(overMinutes / 60);
  const overMins = overMinutes % 60;
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMins = remainingMinutes % 60;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
      <span>
        {t('schedule.bookedTime')}:{' '}
        <span className="font-medium text-foreground">
          {t('schedule.bookedTimeValue', { hours: stats.hours, minutes: stats.minutes })}
        </span>
      </span>

      {hasCapacity ? (
        <>
          <span>
            {t('schedule.availableHours')}:{' '}
            <span className="font-medium text-foreground">
              {t('schedule.availableHoursValue', { hours: availableHours })}
            </span>
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
              isOverbooked
                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
            )}
          >
            {isOverbooked
              ? t('schedule.overbookedBy', { hours: overHours, minutes: overMins })
              : remainingMinutes > 0
                ? t('schedule.remainingCapacity', {
                    hours: remainingHours,
                    minutes: remainingMins,
                  })
                : t('schedule.withinCapacity')}
          </span>
        </>
      ) : null}
    </div>
  );
}
