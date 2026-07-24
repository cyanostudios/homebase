import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Filter/stat chip used above plugin lists (§0.1).
 * Label + color dot on the left, number on the right.
 */
export function ListFilterStatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'group rounded-xl border-0 bg-card px-6 py-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-primary/10 hover:text-primary',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors group-hover:text-primary dark:text-slate-500">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClassName)} aria-hidden />
          <span className="truncate">{label}</span>
        </div>
        <div className="shrink-0 text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground transition-colors group-hover:text-primary">
          {value}
        </div>
      </div>
    </Card>
  );
}
