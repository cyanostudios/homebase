import React from 'react';
import { createPortal } from 'react-dom';

import { useIsDesktopLayout } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import {
  resolveDetailLayoutGridClass,
  shouldPortalDetailSidebar,
  shouldPreferDetailSidebarPortal,
} from './detailLayoutPortal';
import { useRightSidebarOptional } from './RightSidebarContext';

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
  const isDesktopLayout = useIsDesktopLayout();
  const rightSidebarCtx = useRightSidebarOptional();
  const portalTarget = rightSidebarCtx?.pluginSlotElement ?? null;
  // Only portal on desktop when the app right rail is open — phone/pad keep the inline column.
  const preferPortal = shouldPreferDetailSidebarPortal({
    isDesktopLayout,
    isRightSidebarOpen: Boolean(rightSidebarCtx?.isOpen),
    hasSidebar: Boolean(sidebar),
  });
  const usePortal = shouldPortalDetailSidebar(preferPortal, portalTarget);

  const layoutSidebar = preferPortal ? undefined : sidebar;
  const hasLeft = Boolean(leftSidebar);
  const hasSidebar = Boolean(layoutSidebar);
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

  const resolvedGridClass = resolveDetailLayoutGridClass({
    preferPortal,
    hasLeft,
    gridClassName,
    defaultGridColsClass,
  });

  return (
    <>
      <div className={cn('grid items-start gap-4', resolvedGridClass, className)}>
        {leftSidebar && <aside className="order-1 min-w-0 space-y-4">{leftSidebar}</aside>}
        <div className={cn('order-2 min-w-0 space-y-4', mainClassName)}>{children}</div>
        {layoutSidebar && <aside className="order-3 min-w-0 space-y-4">{layoutSidebar}</aside>}
        {rightSidebar && <aside className="order-4 min-w-0 space-y-4">{rightSidebar}</aside>}
      </div>
      {usePortal && portalTarget ? createPortal(sidebar, portalTarget) : null}
    </>
  );
}
