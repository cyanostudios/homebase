import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { BADGE_CHIP_CLASS, BADGE_CHIP_COMPACT_CLASS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

type StatusOutlineBadgeProps = {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  title?: string;
};

/**
 * Read-only status label: icon + extrabold colored text (no chip padding/chrome).
 * Renders a `span` so it aligns inside Select triggers / items.
 */
export function StatusOutlineBadge({
  icon: Icon,
  children,
  className,
  compact = false,
  title,
}: StatusOutlineBadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 border-0 bg-transparent p-0 leading-none',
        compact ? BADGE_CHIP_COMPACT_CLASS : BADGE_CHIP_CLASS,
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center leading-none',
            compact ? 'size-3 [&_svg]:size-3' : 'size-3.5 [&_svg]:size-3.5',
          )}
        >
          <Icon aria-hidden className="block" />
        </span>
      ) : null}
      <span className="min-w-0 truncate leading-none">{children}</span>
    </span>
  );
}
