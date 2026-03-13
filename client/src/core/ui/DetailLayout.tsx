import React from 'react';

import { cn } from '@/lib/utils';

interface DetailLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  /** Optional third column (e.g. activity log). When set, layout becomes three columns on lg. */
  rightSidebar?: React.ReactNode;
  className?: string;
}

export function DetailLayout({ children, sidebar, rightSidebar, className }: DetailLayoutProps) {
  const hasRight = Boolean(rightSidebar);
  return (
    <div
      className={cn(
        'grid gap-8',
        hasRight
          ? 'grid-cols-1 lg:grid-cols-[1fr_280px_280px]'
          : 'grid-cols-1 lg:grid-cols-[1fr_320px]',
        className,
      )}
    >
      <div className="min-w-0 space-y-6">{children}</div>
      {sidebar && <aside className="space-y-8 min-w-0">{sidebar}</aside>}
      {rightSidebar && <aside className="space-y-8 min-w-0">{rightSidebar}</aside>}
    </div>
  );
}
