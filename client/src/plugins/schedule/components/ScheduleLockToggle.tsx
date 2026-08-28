import { Lock, Unlock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';

export type ScheduleLockToggleProps = {
  locked: boolean;
  disabled?: boolean;
  onToggle: (nextLocked: boolean) => void | boolean | Promise<void | boolean>;
  className?: string;
  /** @deprecated Round button uses standard icon size. */
  iconClassName?: string;
};

const lockedContentClass =
  'text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300';
const unlockedContentClass =
  'text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300';

/**
 * Clickable lock — white round pill; red Lock when locked, green Unlock when open.
 */
export function ScheduleLockToggle({
  locked,
  disabled = false,
  onToggle,
  className,
}: ScheduleLockToggleProps) {
  const { t } = useTranslation();
  const label = locked ? t('schedule.settings.unlock') : t('schedule.settings.lock');

  return (
    <RoundIconLabelButton
      type="button"
      icon={locked ? Lock : Unlock}
      label={label}
      variant="secondary"
      expandOnHover={false}
      disabled={disabled}
      aria-pressed={locked}
      contentClassName={locked ? lockedContentClass : unlockedContentClass}
      className={cn(
        'shrink-0 bg-white hover:bg-primary/10 dark:bg-slate-950 dark:hover:bg-primary/10',
        className,
      )}
      onClick={() => {
        void onToggle(!locked);
      }}
    />
  );
}
