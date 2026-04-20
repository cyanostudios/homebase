import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

export interface ItemNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  label: string;
  className?: string;
}

const PAGER_BTN_CLASS =
  'inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent';

export function ItemNavigation({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  label,
  className,
}: ItemNavigationProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-1 rounded-md bg-card p-1 shadow-sm', className)}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous item"
        className={PAGER_BTN_CLASS}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="px-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next item"
        className={PAGER_BTN_CLASS}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
