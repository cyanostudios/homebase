import { ChevronLeft, ChevronRight, Rows3 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';

import {
  SCHEDULE_DAY_SPAN_COMPANION_GRID_OPTIONS,
  SCHEDULE_DAY_SPAN_GRID_OPTIONS,
  type ScheduleDaySpan,
} from '../utils/scheduleDaySpan';

export type ScheduleDaySpanToggleProps = {
  daySpan: ScheduleDaySpan;
  onSelect: (span: ScheduleDaySpan) => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  /** Hide 7-day option (Companion Panel). */
  companion?: boolean;
};

const segmentClass = cn(
  'inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2.5 text-xs font-extrabold',
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
);

/**
 * Segmented control: 1 | 3 | 7 | stacked — round pill like ListColumnLayoutToggle.
 * Companion mode omits 7. Prev/next browse within the week for span 1 and 3 only.
 */
export function ScheduleDaySpanToggle({
  daySpan,
  onSelect,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  companion = false,
}: ScheduleDaySpanToggleProps) {
  const { t } = useTranslation();
  const showBrowse = daySpan === 1 || daySpan === 3;
  const isStacked = daySpan === 'stacked';
  const gridOptions = companion
    ? SCHEDULE_DAY_SPAN_COMPANION_GRID_OPTIONS
    : SCHEDULE_DAY_SPAN_GRID_OPTIONS;

  return (
    <div className="flex items-center gap-1.5">
      {showBrowse ? (
        <RoundIconLabelButton
          type="button"
          icon={ChevronLeft}
          label={t(daySpan === 1 ? 'schedule.daySpanPrevDay' : 'schedule.daySpanPrevDays')}
          variant="secondary"
          expandOnHover={false}
          disabled={!canGoPrev}
          onClick={onPrev}
        />
      ) : null}

      <div
        role="group"
        aria-label={t('schedule.daySpanGroup')}
        className="inline-flex h-11 items-center gap-0.5 rounded-full bg-primary/10 p-0.5"
      >
        {gridOptions.map((span) => {
          const selected = !isStacked && daySpan === span;
          return (
            <button
              key={span}
              type="button"
              className={cn(
                segmentClass,
                selected
                  ? 'bg-primary text-primary-foreground hover:brightness-[0.92] dark:hover:brightness-110'
                  : 'text-muted-foreground hover:bg-primary/15 hover:text-primary',
              )}
              onClick={() => onSelect(span)}
              aria-label={t(`schedule.daySpan${span}`)}
              aria-pressed={selected}
            >
              {span}
            </button>
          );
        })}
        <button
          type="button"
          className={cn(
            segmentClass,
            'px-2',
            isStacked
              ? 'bg-primary text-primary-foreground hover:brightness-[0.92] dark:hover:brightness-110'
              : 'text-muted-foreground hover:bg-primary/15 hover:text-primary',
          )}
          onClick={() => onSelect('stacked')}
          aria-label={t('schedule.daySpanStacked')}
          aria-pressed={isStacked}
          title={t('schedule.daySpanStacked')}
        >
          <Rows3 className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      </div>

      {showBrowse ? (
        <RoundIconLabelButton
          type="button"
          icon={ChevronRight}
          label={t(daySpan === 1 ? 'schedule.daySpanNextDay' : 'schedule.daySpanNextDays')}
          variant="secondary"
          expandOnHover={false}
          disabled={!canGoNext}
          onClick={onNext}
        />
      ) : null}
    </div>
  );
}
