import { useCallback, useMemo, useState } from 'react';

import {
  canShiftScheduleAnchor,
  getInitialScheduleDaySpan,
  getTodayWeekDay,
  persistScheduleDaySpanSession,
  resolveVisibleWeekDays,
  shiftScheduleAnchor,
  type ScheduleDaySpan,
  type WeekDay,
} from '../utils/scheduleDaySpan';

export function useScheduleDaySpan(): {
  daySpan: ScheduleDaySpan;
  setDaySpan: (span: ScheduleDaySpan) => void;
  visibleDays: readonly WeekDay[];
  isStackedView: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => void;
} {
  const [daySpan, setDaySpanState] = useState<ScheduleDaySpan>(getInitialScheduleDaySpan);
  const [anchorDay, setAnchorDay] = useState<WeekDay>(getTodayWeekDay);

  const setDaySpan = useCallback((span: ScheduleDaySpan) => {
    setDaySpanState(span);
    persistScheduleDaySpanSession(span);
    setAnchorDay(getTodayWeekDay());
  }, []);

  const isStackedView = daySpan === 'stacked';

  const visibleDays = useMemo(
    () => resolveVisibleWeekDays(daySpan, anchorDay),
    [daySpan, anchorDay],
  );

  const canGoPrev =
    (daySpan === 1 || daySpan === 3) && canShiftScheduleAnchor(daySpan, anchorDay, -1);
  const canGoNext =
    (daySpan === 1 || daySpan === 3) && canShiftScheduleAnchor(daySpan, anchorDay, 1);

  const goPrev = useCallback(() => {
    const next = shiftScheduleAnchor(daySpan, anchorDay, -1);
    if (next) {
      setAnchorDay(next);
    }
  }, [daySpan, anchorDay]);

  const goNext = useCallback(() => {
    const next = shiftScheduleAnchor(daySpan, anchorDay, 1);
    if (next) {
      setAnchorDay(next);
    }
  }, [daySpan, anchorDay]);

  return {
    daySpan,
    setDaySpan,
    visibleDays,
    isStackedView,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
  };
}
