import { ChevronLeft, ChevronRight, Rows3 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { SCHEDULE_DAY_SPAN_GRID_OPTIONS, type ScheduleDaySpan } from '../utils/scheduleDaySpan';

export type ScheduleDaySpanToggleProps = {
  daySpan: ScheduleDaySpan;
  onSelect: (span: ScheduleDaySpan) => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

/**
 * Segmented control: 1 | 3 | 7 | stacked — mirrors ListColumnLayoutToggle (numbers + icon mode).
 * Prev/next browse within the week for span 1 and 3 only.
 */
export function ScheduleDaySpanToggle({
  daySpan,
  onSelect,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
}: ScheduleDaySpanToggleProps) {
  const { t } = useTranslation();
  const showBrowse = daySpan === 1 || daySpan === 3;
  const isStacked = daySpan === 'stacked';

  return (
    <div className="flex items-center gap-1">
      {showBrowse ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={ChevronLeft}
          className="h-7 w-7 px-0 text-muted-foreground hover:text-foreground"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label={t(daySpan === 1 ? 'schedule.daySpanPrevDay' : 'schedule.daySpanPrevDays')}
        />
      ) : null}

      <div
        role="group"
        aria-label={t('schedule.daySpanGroup')}
        className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5"
      >
        {SCHEDULE_DAY_SPAN_GRID_OPTIONS.map((span) => (
          <Button
            key={span}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 min-w-7 rounded-[6px] px-2 text-xs',
              !isStacked && daySpan === span
                ? 'bg-background text-foreground shadow-sm hover:bg-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onSelect(span)}
            aria-label={t(`schedule.daySpan${span}`)}
            aria-pressed={!isStacked && daySpan === span}
          >
            {span}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={Rows3}
          className={cn(
            'h-7 min-w-7 rounded-[6px] px-2 text-xs',
            isStacked
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onSelect('stacked')}
          aria-label={t('schedule.daySpanStacked')}
          aria-pressed={isStacked}
          title={t('schedule.daySpanStacked')}
        />
      </div>

      {showBrowse ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={ChevronRight}
          className="h-7 w-7 px-0 text-muted-foreground hover:text-foreground"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label={t(daySpan === 1 ? 'schedule.daySpanNextDay' : 'schedule.daySpanNextDays')}
        />
      ) : null}
    </div>
  );
}
