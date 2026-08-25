import React from 'react';

import { cn } from '@/lib/utils';

export interface ListFooterBarProps {
  /** Left slot (e.g. quick-add). Optional. */
  leading?: React.ReactNode;
  /** Meta, e.g. "Showing X of Y" (left-aligned). */
  meta: React.ReactNode;
  className?: string;
}

/**
 * List footer: optional leading control left, count meta left-aligned on a transparent surface.
 */
export function ListFooterBar({ leading, meta, className }: ListFooterBarProps) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-shrink-0 flex-wrap items-center gap-3 bg-transparent px-4 pb-2 pt-0',
        className,
      )}
    >
      {leading ? <div className="min-w-0">{leading}</div> : null}
      <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}
