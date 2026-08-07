import { Plus } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ListEmptyStateProps {
  /** Empty or no-match message. */
  message: React.ReactNode;
  /**
   * Create CTA label. Pass only when the list is truly empty (no search/filter),
   * not for "no match" results.
   */
  createLabel?: string;
  /** Opens the plugin create flow (same handler as header Add). */
  onCreate?: () => void;
  className?: string;
}

/**
 * Default entity-list empty state: muted card + optional primary Create button.
 * Create is shown only when both `createLabel` and `onCreate` are provided.
 */
export function ListEmptyState({ message, createLabel, onCreate, className }: ListEmptyStateProps) {
  const showCreate = Boolean(createLabel && onCreate);

  return (
    <div
      className={cn(
        'rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950',
        className,
      )}
    >
      {message}
      {showCreate ? (
        <div className="mt-3">
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={onCreate}
          >
            {createLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
