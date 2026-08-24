import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Phone: compact chips in a horizontal scroll row.
 * Pad/desktop: normal grid (append `md:grid-cols-*` / `lg:grid-cols-*` at call site).
 */
export const LIST_FILTER_STAT_ROW_CLASS =
  'flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:overflow-visible md:pb-0';

/**
 * Filter/stat chip used above plugin lists (§0.1).
 * Label + color dot on the left, number on the right.
 * Compact on phone (chip-sized); full size from `md` up.
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
        'group min-w-[8.75rem] shrink-0 rounded-xl border-0 bg-card px-3 py-2 shadow-sm transition-colors md:min-w-0 md:px-6 md:py-4',
        onClick && 'cursor-pointer hover:bg-primary/10 hover:text-primary',
        active && 'bg-primary/10 text-primary ring-1 ring-border/70',
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
      <div className="flex items-center justify-between gap-3 md:gap-5">
        <div
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors group-hover:text-primary md:gap-2 md:text-xs',
            active ? 'text-primary' : 'text-slate-400 dark:text-slate-500',
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full md:h-2 md:w-2', dotClassName)}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </div>
        <div
          className={cn(
            'shrink-0 text-lg font-semibold leading-none tracking-tight tabular-nums transition-colors group-hover:text-primary md:text-3xl',
            active ? 'text-primary' : 'text-foreground',
          )}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}
