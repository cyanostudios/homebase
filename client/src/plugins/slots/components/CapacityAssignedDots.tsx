import React from 'react';

import { cn } from '@/lib/utils';

interface CapacityAssignedDotsProps {
  capacity: number;
  assignedCount: number;
  className?: string;
}

function getAriaLabel(capacity: number, assignedCount: number): string {
  if (assignedCount === 0) {
    return `${capacity} capacity, none assigned`;
  }
  if (assignedCount <= capacity) {
    return `${assignedCount} of ${capacity} assigned`;
  }
  return `${assignedCount} assigned, over capacity (${capacity})`;
}

export function CapacityAssignedDots({
  capacity,
  assignedCount,
  className,
}: CapacityAssignedDotsProps) {
  const capped = Math.max(0, capacity);
  const filled = Math.min(assignedCount, capped);
  const over = assignedCount > capped;

  const ariaLabel = getAriaLabel(capacity, assignedCount);

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {Array.from({ length: capped }, (_, i) => (
        <span
          key={i}
          className={cn(
            'inline-block w-2 h-2 rounded-full shrink-0',
            i < filled ? 'bg-green-600 dark:bg-green-500' : 'bg-red-600 dark:bg-red-500',
          )}
        />
      ))}
      {over && <span className="text-muted-foreground text-[10px] font-medium ml-0.5">+</span>}
    </span>
  );
}
