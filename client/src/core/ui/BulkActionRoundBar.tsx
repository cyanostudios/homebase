import React from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import type { AppIcon } from '@/types/icons';
import { cn } from '@/lib/utils';

export type BulkActionRoundItem = {
  key: string;
  label: string;
  icon: AppIcon;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'destructive';
  /** Overrides tone-based icon + label color. */
  contentClassName?: string;
};

const bulkContentToneClass = {
  default: 'text-foreground group-hover:text-primary',
  destructive:
    'text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300',
} as const;

const countPillClass =
  'inline-flex h-11 items-center rounded-full border border-blue-200 bg-secondary px-3.5 text-sm font-extrabold text-blue-800 dark:border-blue-800 dark:text-blue-200';

export function BulkActionRoundBar({
  selectedCount,
  actions,
  className,
}: {
  selectedCount: number;
  actions: BulkActionRoundItem[];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span className={countPillClass}>{t('bulk.selected', { count: selectedCount })}</span>
      {actions.map((action) => {
        const tone = action.tone ?? 'default';
        return (
          <RoundIconLabelButton
            key={action.key}
            icon={action.icon}
            label={action.label}
            variant="secondary"
            alwaysExpanded
            disabled={action.disabled}
            contentClassName={action.contentClassName ?? bulkContentToneClass[tone]}
            onClick={action.onClick}
          />
        );
      })}
    </div>
  );
}
