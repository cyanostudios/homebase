import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { usePomodoro } from '@/core/ui/rightSidebar/PomodoroContext';
import { TomatoIcon } from '@/core/widgets/pomodoro/TomatoIcon';
import { cn } from '@/lib/utils';
import type { AppIcon } from '@/types/icons';

const TomatoAppIcon = TomatoIcon as AppIcon;

/** 1s water ripple; shared with timer rail (see `.widget-rail-ripple` in index.css). */
const RIPPLE_CLASS =
  'widget-rail-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-green-500/70';

export function PomodoroRailButton({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { state } = usePomodoro();
  const isRunning = state === 'running';

  return (
    <div className="relative isolate">
      {isRunning ? (
        <>
          <span aria-hidden className={RIPPLE_CLASS} />
          <span aria-hidden className={cn(RIPPLE_CLASS, '[animation-delay:0.33s]')} />
          <span aria-hidden className={cn(RIPPLE_CLASS, '[animation-delay:0.66s]')} />
        </>
      ) : null}
      <RoundIconLabelButton
        icon={TomatoAppIcon}
        label={t('rightSidebar.pomodoro')}
        variant={isRunning ? 'success' : selected ? 'soft' : 'category'}
        size="xs"
        expandOnHover={false}
        aria-pressed={selected}
        className="relative z-10"
        onClick={onClick}
      />
    </div>
  );
}
