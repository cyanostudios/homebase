import { Lock, Unlock } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

export type ScheduleLockToggleProps = {
  locked: boolean;
  disabled?: boolean;
  onToggle: (nextLocked: boolean) => void | boolean | Promise<void | boolean>;
  className?: string;
  iconClassName?: string;
};

/**
 * Clickable lock status icon — red Lock when locked, green Unlock when open.
 */
export function ScheduleLockToggle({
  locked,
  disabled = false,
  onToggle,
  className,
  iconClassName = 'h-4 w-4',
}: ScheduleLockToggleProps) {
  const { t } = useTranslation();
  const label = locked ? t('schedule.settings.unlock') : t('schedule.settings.lock');

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={locked}
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md p-0.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        locked
          ? 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300'
          : 'text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/30 dark:hover:text-green-300',
        className,
      )}
      onClick={() => {
        void onToggle(!locked);
      }}
    >
      {locked ? (
        <Lock className={cn(iconClassName, 'shrink-0')} aria-hidden />
      ) : (
        <Unlock className={cn(iconClassName, 'shrink-0')} aria-hidden />
      )}
    </button>
  );
}
