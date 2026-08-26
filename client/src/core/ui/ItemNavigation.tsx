import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { cn } from '@/lib/utils';

export interface ItemNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  label: string;
  className?: string;
}

const countPillClass =
  'inline-flex h-11 shrink-0 items-center rounded-full bg-secondary px-3.5 text-sm font-extrabold tabular-nums text-secondary-foreground';

export function ItemNavigation({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  label,
  className,
}: ItemNavigationProps) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <RoundIconLabelButton
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        icon={ChevronLeft}
        label="Previous item"
        variant="secondary"
        expandOnHover={false}
      />
      <span className={countPillClass}>{label}</span>
      <RoundIconLabelButton
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        icon={ChevronRight}
        label="Next item"
        variant="secondary"
        expandOnHover={false}
      />
    </div>
  );
}
