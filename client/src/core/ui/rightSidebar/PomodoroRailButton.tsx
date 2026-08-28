import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  RoundIconLabelButton,
  type RoundIconLabelButtonVariant,
} from '@/components/ui/round-icon-label-button';
import { usePomodoro } from '@/core/ui/rightSidebar/PomodoroContext';
import { TomatoIcon } from '@/core/widgets/pomodoro/TomatoIcon';
import type { AppIcon } from '@/types/icons';

const TomatoAppIcon = TomatoIcon as AppIcon;

function variantForSession(
  sessionType: 'work' | 'shortBreak' | 'longBreak',
  selected: boolean,
): RoundIconLabelButtonVariant {
  // Selected tool → soft primary blue; otherwise match session badge colors.
  if (selected) {
    return 'soft';
  }
  switch (sessionType) {
    case 'shortBreak':
      return 'success';
    case 'longBreak':
      return 'primary';
    case 'work':
    default:
      return 'danger';
  }
}

export function PomodoroRailButton({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { sessionType } = usePomodoro();

  return (
    <RoundIconLabelButton
      icon={TomatoAppIcon}
      label={t('rightSidebar.pomodoro')}
      variant={variantForSession(sessionType, selected)}
      size="xs"
      expandOnHover={false}
      aria-pressed={selected}
      onClick={onClick}
    />
  );
}
