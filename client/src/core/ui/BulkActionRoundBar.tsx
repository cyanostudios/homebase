import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  RoundIconLabelButton,
  type RoundIconLabelButtonSize,
} from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';
import type { AppIcon } from '@/types/icons';

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

/** Shared with ConfirmDialog / DialogDeleteButton — gray secondary shell, red icon+label. */
export const BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS =
  'text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300';

const bulkContentToneClass = {
  default: 'text-foreground group-hover:text-primary',
  destructive: BULK_ACTION_DESTRUCTIVE_CONTENT_CLASS,
} as const;

const countPillSizeClass: Record<RoundIconLabelButtonSize, string> = {
  xs: 'h-[2.0625rem] px-3 text-[11px]',
  sm: 'h-11 px-3.5 text-xs',
  md: 'h-12 px-4 text-sm',
};

export function BulkActionRoundBar({
  selectedCount,
  actions,
  className,
  size = 'sm',
}: {
  selectedCount: number;
  actions: BulkActionRoundItem[];
  className?: string;
  size?: RoundIconLabelButtonSize;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-blue-200 bg-secondary font-extrabold text-blue-800 dark:border-blue-800 dark:text-blue-200',
          countPillSizeClass[size],
        )}
      >
        {t('bulk.selected', { count: selectedCount })}
      </span>
      {actions.map((action) => {
        const tone = action.tone ?? 'default';
        return (
          <RoundIconLabelButton
            key={action.key}
            icon={action.icon}
            label={action.label}
            variant="secondary"
            size={size}
            alwaysExpanded
            className="text-xs"
            disabled={action.disabled}
            contentClassName={action.contentClassName ?? bulkContentToneClass[tone]}
            onClick={action.onClick}
          />
        );
      })}
    </div>
  );
}
