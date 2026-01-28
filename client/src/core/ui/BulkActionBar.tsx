// client/src/core/ui/BulkActionBar.tsx
// Generic bulk action bar component for list views

import { type LucideIcon } from 'lucide-react';
import React from 'react';

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
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={`mt-2 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 ${className}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
          {selectedCount} selected
        </span>
        <button
          className="underline text-blue-700 hover:text-blue-900 py-1.5 min-h-[44px] sm:min-h-0"
          onClick={onClearSelection}
          type="button"
        >
          Clear selection
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
              size="sm"
              onClick={action.onClick}
              className={`min-h-[44px] sm:min-h-0 w-full sm:w-auto ${
                action.variant === 'destructive'
                  ? 'border-red-600 text-red-700 hover:bg-red-50'
                  : ''
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
