import { Timer } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useTimer } from '@/core/ui/rightSidebar/TimerContext';
import { cn } from '@/lib/utils';

/** 1s water ripple; shared with pomodoro rail (see `.widget-rail-ripple` in index.css). */
const RIPPLE_CLASS =
  'widget-rail-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-green-500/70';

export function TimerRailButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const { timers } = useTimer();
  const anyRunning = timers.some((timer) => timer.isRunning);

  return (
    <div className="relative isolate">
      {anyRunning ? (
        <>
          <span aria-hidden className={RIPPLE_CLASS} />
          <span aria-hidden className={cn(RIPPLE_CLASS, '[animation-delay:0.33s]')} />
          <span aria-hidden className={cn(RIPPLE_CLASS, '[animation-delay:0.66s]')} />
        </>
      ) : null}
      <RoundIconLabelButton
        icon={Timer}
        label={t('rightSidebar.timer')}
        variant={anyRunning ? 'success' : selected ? 'soft' : 'secondary'}
        size="xs"
        expandOnHover={false}
        aria-pressed={selected}
        className="relative z-10"
        onClick={onClick}
      />
    </div>
  );
}
