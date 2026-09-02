import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useApp } from '@/core/api/AppContext';
import { buildNavCategories } from '@/core/navigation/buildNavCategories';
import { findActiveCategoryId, findSubmenuParentPage } from '@/core/navigation/collapsibleState';
import type { NavPage } from '@/core/navigation/navTypes';
import { useLeftSidebar } from '@/core/ui/sidebar/LeftSidebarContext';
import { SidebarBrand } from '@/core/ui/sidebar/SidebarBrand';
import {
  SidebarNavContent,
  type SidebarNavContentProps,
} from '@/core/ui/sidebar/SidebarNavContent';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useIsDesktopLayout } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { toggleSetItem } from '@/lib/setUtils';

export type { NavPage } from '@/core/navigation/navTypes';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  currentPage,
  onPageChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const enabledPlugins = useEnabledPlugins();
  const { navBadges } = useApp();
  const { t, i18n } = useTranslation();
  const isDesktopLayout = useIsDesktopLayout();
  const { collapsed, widthPx, toggleCollapsed, setCollapsed } = useLeftSidebar();
  const [userOpenSubmenus, setUserOpenSubmenus] = useState<Set<NavPage>>(() => new Set());
  const [userClosedSubmenus, setUserClosedSubmenus] = useState<Set<NavPage>>(() => new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const didInitCategoriesRef = useRef(false);

  const navCategories = useMemo(
    () => buildNavCategories(enabledPlugins, t, navBadges),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t follows i18n.language on locale change
    [enabledPlugins, i18n.language, navBadges],
  );

  const activeCategoryId = useMemo(
    () => findActiveCategoryId(navCategories, currentPage),
    [currentPage, navCategories],
  );

  useLayoutEffect(() => {
    if (!didInitCategoriesRef.current && activeCategoryId) {
      didInitCategoriesRef.current = true;
      setOpenCategories(new Set([activeCategoryId]));
    }
  }, [activeCategoryId]);

  useEffect(() => {
    if (!activeCategoryId) {
      return;
    }
    setOpenCategories((prev) => {
      if (prev.has(activeCategoryId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeCategoryId);
      return next;
    });
  }, [activeCategoryId]);

  useEffect(() => {
    const parentPage = findSubmenuParentPage(navCategories, currentPage);
    if (!parentPage) {
      return;
    }
    setUserClosedSubmenus((prev) => {
      if (!prev.has(parentPage)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(parentPage);
      return next;
    });
  }, [currentPage, navCategories]);

  const handleNavigate = useCallback(
    (page: NavPage) => {
      if (!isDesktopLayout) {
        onMobileOpenChange(false);
      }
      onPageChange(page);
    },
    [isDesktopLayout, onMobileOpenChange, onPageChange],
  );

  const handleSubmenuOpenChange = useCallback((page: NavPage, open: boolean) => {
    setUserOpenSubmenus((prev) => toggleSetItem(prev, page, open));
    setUserClosedSubmenus((prev) => toggleSetItem(prev, page, !open));
  }, []);

  const handleCategoryOpenChange = useCallback((categoryId: string, open: boolean) => {
    setOpenCategories((prev) => toggleSetItem(prev, categoryId, open));
  }, []);

  const handleCollapsedCategorySelect = useCallback(
    (categoryId: string) => {
      setCollapsed(false);
      setOpenCategories((prev) => {
        const next = new Set(prev);
        next.add(categoryId);
        return next;
      });
    },
    [setCollapsed],
  );

  const navContentProps: SidebarNavContentProps = {
    navCategories,
    currentPage,
    userOpenSubmenus,
    userClosedSubmenus,
    openCategories,
    onNavigate: handleNavigate,
    onSubmenuOpenChange: handleSubmenuOpenChange,
    onCategoryOpenChange: handleCategoryOpenChange,
    collapsed: isDesktopLayout ? collapsed : false,
    activeCategoryId,
    onCollapsedCategorySelect: handleCollapsedCategorySelect,
  };

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 hidden h-screen flex-shrink-0 bg-workspace transition-[width] duration-300 ease-out lg:flex',
        )}
        style={{ width: widthPx }}
        aria-label={t('nav.navigation')}
      >
        <div className="relative flex h-full w-full flex-col">
          <SidebarBrand collapsed={collapsed} />
          <SidebarNavContent {...navContentProps} navId="left-sidebar-nav" />
          <div className="pointer-events-none absolute right-0 top-1 z-20">
            <div className="pointer-events-auto translate-x-1/2">
              <RoundIconLabelButton
                icon={collapsed ? ChevronRight : ChevronLeft}
                label={
                  collapsed
                    ? t('nav.expandSidebar', { defaultValue: 'Expand sidebar' })
                    : t('nav.collapseSidebar', { defaultValue: 'Collapse sidebar' })
                }
                variant="secondary"
                size="xs"
                expandOnHover={false}
                className="bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground"
                aria-expanded={!collapsed}
                aria-controls="left-sidebar-nav"
                onClick={toggleCollapsed}
              />
            </div>
          </div>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="flex w-72 flex-col border-0 bg-workspace p-0">
          <SheetHeader className="space-y-0 p-0 text-left">
            <SheetTitle className="sr-only">{t('nav.navigation')}</SheetTitle>
            <SidebarBrand />
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-2 pb-0 pt-2">
            <SidebarNavContent {...navContentProps} collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
