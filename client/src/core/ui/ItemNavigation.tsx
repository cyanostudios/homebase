import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ItemNavigationProps {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  label: string;
  className?: string;
}

export function ItemNavigation({
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  label,
  className,
}: ItemNavigationProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous item"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3rem] text-center text-xs text-muted-foreground">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next item"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
