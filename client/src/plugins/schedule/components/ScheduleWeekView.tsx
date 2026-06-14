import { MapPin } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SERIES_TEAM_ROW_STYLES, WEEK_DAYS } from '@/plugins/teams/types/teams';

import type { ScheduleSlot } from '../types/schedule';

function getSlotClassName(slot: ScheduleSlot, isClickable: boolean) {
  const colorStyles = slot.teamColor ? SERIES_TEAM_ROW_STYLES[slot.teamColor] : null;

  return cn(
    'flex rounded-md border px-2 py-1.5',
    colorStyles ?? 'border-plugin-subtle/60 bg-background/80 text-foreground',
    isClickable &&
      (colorStyles
        ? 'cursor-pointer text-left transition-[filter,box-shadow] hover:brightness-[0.98] hover:shadow-sm dark:hover:brightness-110'
        : 'cursor-pointer text-left transition-colors hover:border-primary/40 hover:bg-primary/5'),
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getSlotsForDay(slots: ScheduleSlot[], day: string): ScheduleSlot[] {
  return slots
    .filter((slot) => slot.day === day)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function groupSlotsByTime(daySlots: ScheduleSlot[]): ScheduleSlot[][] {
  const groups: ScheduleSlot[][] = [];
  let currentKey = '';
  for (const slot of daySlots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (key !== currentKey) {
      groups.push([slot]);
      currentKey = key;
    } else {
      groups[groups.length - 1].push(slot);
    }
  }
  return groups;
}

function ScheduleSlotBlock({ slot }: { slot: ScheduleSlot }) {
  const timeLabel = slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
  const label = slot.teamName || slot.title;

  return (
    <div className="flex min-w-[7rem] max-w-[10rem] flex-col items-start gap-0.5 text-left">
      <span className="text-xs font-semibold leading-tight">{timeLabel}</span>
      {label ? (
        <span className="truncate text-[10px] font-medium leading-tight opacity-90">{label}</span>
      ) : null}
      {slot.location ? (
        <span className="inline-flex max-w-full items-center gap-0.5 text-[10px] leading-tight opacity-75">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{slot.location}</span>
        </span>
      ) : null}
    </div>
  );
}

export function ScheduleWeekView({
  slots,
  onSlotClick,
}: {
  slots: ScheduleSlot[];
  onSlotClick?: (slot: ScheduleSlot) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 overflow-visible pt-1">
      {WEEK_DAYS.map((day) => {
        const daySlots = getSlotsForDay(slots, day);
        const timeGroups = groupSlotsByTime(daySlots);
        const hasSlots = daySlots.length > 0;

        return (
          <div
            key={day}
            className={cn(
              'flex items-stretch gap-3 rounded-lg border p-2',
              hasSlots ? 'border-plugin-subtle bg-plugin-subtle' : 'border-transparent bg-muted/50',
            )}
          >
            <span className="flex w-9 shrink-0 items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`teams.daysShort.${day}`)}
            </span>

            {!hasSlots ? (
              <span className="flex flex-1 items-center text-xs text-muted-foreground/50">—</span>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {timeGroups.map((group) => {
                  const timeKey = `${group[0].startTime}-${group[0].endTime}`;
                  return (
                    <div key={`${day}-${timeKey}`} className="flex flex-wrap items-stretch gap-1.5">
                      {group.map((slot, index) => {
                        const isClickable = Boolean(slot.teamId && onSlotClick);
                        const slotClassName = getSlotClassName(slot, isClickable);
                        const slotKey = `${day}-${timeKey}-${slot.teamName || slot.title || ''}-${index}`;

                        return isClickable ? (
                          <button
                            key={slotKey}
                            type="button"
                            onClick={() => onSlotClick!(slot)}
                            className={slotClassName}
                          >
                            <ScheduleSlotBlock slot={slot} />
                          </button>
                        ) : (
                          <div key={slotKey} className={slotClassName}>
                            <ScheduleSlotBlock slot={slot} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
