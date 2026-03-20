import React from 'react';

import { cn } from '@/lib/utils';

interface DetailLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  /** Optional third column (e.g. activity log). When set, layout becomes three columns on lg. */
  rightSidebar?: React.ReactNode;
  className?: string;
  /** Optional class for the main content column (e.g. max-w-[920px]). */
  mainClassName?: string;
}

export function DetailLayout({
  children,
  sidebar,
  rightSidebar,
  className,
  mainClassName,
}: DetailLayoutProps) {
  const hasRight = Boolean(rightSidebar);
  return (
    <div
      className={cn(
        'grid gap-4',
        hasRight
          ? 'grid-cols-1 lg:grid-cols-[1fr_280px_280px]'
          : 'grid-cols-1 lg:grid-cols-[1fr_320px]',
        className,
      )}
    >
      <div className={cn('min-w-0 space-y-4', mainClassName)}>{children}</div>
      {sidebar && <aside className="space-y-4 min-w-0">{sidebar}</aside>}
      {rightSidebar && <aside className="space-y-4 min-w-0">{rightSidebar}</aside>}
    </div>
  );
}
