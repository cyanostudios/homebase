import React, { useCallback, useEffect, useRef } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BUTTON_COLOR_TRANSITION_CLASS } from '@/components/ui/button';
import type { NavCategory, NavPage } from '@/core/navigation/navTypes';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { getNavItemIconClass } from '@/core/ui/sidebar/navItemStyles';
import { cn } from '@/lib/utils';

const HOVER_OPEN_DELAY_MS = 150;
const LEAVE_CLOSE_DELAY_MS = 200;

export type CollapsedCategoryFlyoutProps = {
  category: NavCategory;
  currentPage: NavPage;
  activeCategoryId?: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (page: NavPage) => void;
  /** When true, show category title label at top of menu. */
  showCategoryTitle?: boolean;
};

export const CollapsedCategoryFlyout = React.memo(function CollapsedCategoryFlyout({
  category,
  currentPage,
  activeCategoryId = null,
  isOpen,
  onOpenChange,
  onNavigate,
  showCategoryTitle = true,
}: CollapsedCategoryFlyoutProps) {
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Parent closed this flyout (e.g. another category opened) — drop pending timers.
  useEffect(() => {
    if (!isOpen) {
      clearTimers();
    }
  }, [isOpen, clearTimers]);

  const isFocusInsideContent = useCallback(() => {
    const content = contentRef.current;
    if (!content) {
      return false;
    }
    return content.contains(document.activeElement);
  }, []);

  const scheduleOpen = useCallback(() => {
    clearCloseTimer();
    if (isOpen) {
      return;
    }
    clearOpenTimer();
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      onOpenChange(true);
    }, HOVER_OPEN_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, isOpen, onOpenChange]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    if (isFocusInsideContent()) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (!isFocusInsideContent()) {
        onOpenChange(false);
      }
    }, LEAVE_CLOSE_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, isFocusInsideContent, onOpenChange]);

  const handleTriggerClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      clearTimers();
      onOpenChange(!isOpen);
    },
    [clearTimers, isOpen, onOpenChange],
  );

  const handleSelect = useCallback(
    (page: NavPage) => {
      clearTimers();
      onOpenChange(false);
      onNavigate(page);
    },
    [clearTimers, onNavigate, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      clearTimers();
      onOpenChange(open);
    },
    [clearTimers, onOpenChange],
  );

  const isActiveCategory = category.id === activeCategoryId;

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={category.title}
          aria-label={category.title}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-current={isActiveCategory ? 'true' : undefined}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            BUTTON_COLOR_TRANSITION_CLASS,
            'hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActiveCategory ? 'bg-primary/10' : undefined,
          )}
          onPointerDown={(event) => event.preventDefault()}
          onClick={handleTriggerClick}
          onPointerEnter={scheduleOpen}
          onPointerLeave={scheduleClose}
        >
          <SectionCategoryIcon icon={category.icon} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={contentRef}
        side="right"
        sideOffset={8}
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
        onPointerEnter={clearCloseTimer}
        onPointerLeave={scheduleClose}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {showCategoryTitle ? (
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
            {category.title}
          </DropdownMenuLabel>
        ) : null}
        {category.items.map((item) => {
          const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);
          if (hasSubmenu && item.submenu) {
            return (
              <React.Fragment key={item.page}>
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                  {item.label}
                </DropdownMenuLabel>
                {item.submenu.map((subItem) => {
                  const SubIcon = subItem.icon;
                  const isActive = subItem.page === currentPage;
                  return (
                    <DropdownMenuItem
                      key={subItem.page}
                      className={cn(
                        'rounded-md text-xs gap-2',
                        isActive && 'text-primary focus:text-primary',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                      onSelect={() => handleSelect(subItem.page)}
                    >
                      <SubIcon className={getNavItemIconClass(isActive)} />
                      <span className="truncate">{subItem.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </React.Fragment>
            );
          }

          const Icon = item.icon;
          const isActive = item.page === currentPage;
          return (
            <DropdownMenuItem
              key={item.page}
              className={cn(
                'rounded-md text-xs gap-2',
                isActive && 'text-primary focus:text-primary',
              )}
              aria-current={isActive ? 'page' : undefined}
              onSelect={() => handleSelect(item.page)}
            >
              <Icon className={getNavItemIconClass(isActive)} />
              <span className="truncate">{item.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
