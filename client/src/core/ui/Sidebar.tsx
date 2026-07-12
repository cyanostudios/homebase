import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildNavCategories } from '@/core/navigation/buildNavCategories';
import { findActiveCategoryId, findSubmenuParentPage } from '@/core/navigation/collapsibleState';
import type { NavPage } from '@/core/navigation/navTypes';
import {
  SidebarNavContent,
  type SidebarNavContentProps,
} from '@/core/ui/sidebar/SidebarNavContent';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useIsMobile } from '@/hooks/useMediaQuery';
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
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [userOpenSubmenus, setUserOpenSubmenus] = useState<Set<NavPage>>(() => new Set());
  const [userClosedSubmenus, setUserClosedSubmenus] = useState<Set<NavPage>>(() => new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const didInitCategoriesRef = useRef(false);

  const navCategories = useMemo(
    () => buildNavCategories(enabledPlugins, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t follows i18n.language on locale change
    [enabledPlugins, i18n.language],
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
      if (isMobile) {
        onMobileOpenChange(false);
      }
      onPageChange(page);
    },
    [isMobile, onMobileOpenChange, onPageChange],
  );

  const handleSubmenuOpenChange = useCallback((page: NavPage, open: boolean) => {
    setUserOpenSubmenus((prev) => toggleSetItem(prev, page, open));
    setUserClosedSubmenus((prev) => toggleSetItem(prev, page, !open));
  }, []);

  const handleCategoryOpenChange = useCallback((categoryId: string, open: boolean) => {
    setOpenCategories((prev) => toggleSetItem(prev, categoryId, open));
  }, []);

  const navContentProps: SidebarNavContentProps = {
    navCategories,
    currentPage,
    userOpenSubmenus,
    userClosedSubmenus,
    openCategories,
    onNavigate: handleNavigate,
    onSubmenuOpenChange: handleSubmenuOpenChange,
    onCategoryOpenChange: handleCategoryOpenChange,
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-10 hidden h-screen w-[252px] flex-shrink-0 bg-workspace border-r border-border/50 md:flex">
        <div className="flex h-full flex-col pt-14">
          <SidebarNavContent {...navContentProps} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 border-border/60 bg-workspace p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>{t('nav.navigation')}</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6 pt-2">
            <div className="flex flex-col">
              <SidebarNavContent {...navContentProps} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
