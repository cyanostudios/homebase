import React from 'react';

import { cn } from '@/lib/utils';

/** Shared max width for detail panel forms (main column). */
export const PANEL_MAX_WIDTH = 'max-w-[920px]';

interface DetailLayoutProps {
  children: React.ReactNode;
  /** Optional narrow column rendered before the main content (e.g. a quick-context style summary). */
  leftSidebar?: React.ReactNode;
  sidebar?: React.ReactNode;
  /** Optional third column (e.g. activity log). When set, layout becomes three columns on lg. */
  rightSidebar?: React.ReactNode;
  className?: string;
  /** Optional class for the main content column (e.g. max-w-[920px]). */
  mainClassName?: string;
  /**
   * Override the default responsive grid column template.
   * When set, replaces the built-in `grid-cols-*` classes derived from which sidebars are present.
   */
  gridClassName?: string;
}

export function DetailLayout({
  children,
  leftSidebar,
  sidebar,
  rightSidebar,
  className,
  mainClassName,
  gridClassName,
}: DetailLayoutProps) {
  const hasLeft = Boolean(leftSidebar);
  const hasSidebar = Boolean(sidebar);
  const hasRight = Boolean(rightSidebar);
  const defaultGridColsClass = hasLeft
    ? hasSidebar || hasRight
      ? 'grid-cols-1 lg:grid-cols-[1fr_1fr_280px]'
      : 'grid-cols-1 lg:grid-cols-[1fr_1fr]'
    : hasRight
      ? 'grid-cols-1 lg:grid-cols-[1fr_280px_280px]'
      : hasSidebar
        ? 'grid-cols-1 lg:grid-cols-[1fr_320px]'
        : 'grid-cols-1';

  return (
    <div className={cn('grid items-start gap-4', gridClassName ?? defaultGridColsClass, className)}>
      {leftSidebar && <aside className="order-1 min-w-0 space-y-4">{leftSidebar}</aside>}
      <div className={cn('order-2 min-w-0 space-y-4', mainClassName)}>{children}</div>
      {sidebar && <aside className="order-3 min-w-0 space-y-4">{sidebar}</aside>}
      {rightSidebar && <aside className="order-4 min-w-0 space-y-4">{rightSidebar}</aside>}
    </div>
  );
}
