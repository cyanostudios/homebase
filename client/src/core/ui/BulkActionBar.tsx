// client/src/core/ui/BulkActionBar.tsx
// Generic bulk action bar component for list views

import { XCircle, type LucideIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

/**
 * BulkActionBar - Displays selected count and action buttons
 * Used in list components to show bulk operation controls
 */
export function BulkActionBar({
  selectedCount,
  onClearSelection,
  actions,
  className = '',
}: BulkActionBarProps) {
  const { t } = useTranslation();
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className={`mt-2 flex flex-col sm:flex-row sm:items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
          {t('bulk.selected', { count: selectedCount })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={XCircle}
          className="h-9 text-xs px-3 text-red-600 underline decoration-red-600/50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:text-red-300"
          onClick={onClearSelection}
          type="button"
        >
          {t('common.clearSelection')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const isDestructive = action.variant === 'destructive';
          return (
            <Button
              key={action.label}
              variant={isDestructive ? 'ghost' : 'secondary'}
              size="sm"
              icon={Icon}
              onClick={action.onClick}
              className={
                isDestructive
                  ? 'h-9 text-xs px-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30'
                  : 'h-9 text-xs px-3'
              }
            >
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
