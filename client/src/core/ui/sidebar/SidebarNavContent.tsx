import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isSubmenuOpen as computeSubmenuOpen } from '@/core/navigation/collapsibleState';
import type { NavCategory, NavPage } from '@/core/navigation/navTypes';
import { SubtleSectionHeading } from '@/core/ui/DetailSection';
import { CollapsedCategoryFlyout } from '@/core/ui/sidebar/CollapsedCategoryFlyout';
import { NavItem } from '@/core/ui/sidebar/NavItem';

export type SidebarNavContentProps = {
  navCategories: NavCategory[];
  currentPage: NavPage;
  userOpenSubmenus: ReadonlySet<NavPage>;
  userClosedSubmenus: ReadonlySet<NavPage>;
  openCategories: ReadonlySet<string>;
  onNavigate: (page: NavPage) => void;
  onSubmenuOpenChange: (page: NavPage, open: boolean) => void;
  onCategoryOpenChange: (categoryId: string, open: boolean) => void;
  /** Desktop icon rail: category icons only. */
  collapsed?: boolean;
  /** Category that contains the current page (collapsed rail highlight). */
  activeCategoryId?: string | null;
  /** Optional DOM id for aria-controls (desktop permanent rail only — avoid duplicates with Sheet). */
  navId?: string;
};

export const SidebarNavContent = React.memo(function SidebarNavContent({
  navCategories,
  currentPage,
  userOpenSubmenus,
  userClosedSubmenus,
  openCategories,
  onNavigate,
  onSubmenuOpenChange,
  onCategoryOpenChange,
  collapsed = false,
  activeCategoryId = null,
  navId,
}: SidebarNavContentProps) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const handleFlyoutOpenChange = useCallback((categoryId: string, open: boolean) => {
    setOpenCategoryId((prev) => {
      if (open) {
        return categoryId;
      }
      // Delayed leave-close from A must not clear a newer open flyout for B.
      return prev === categoryId ? null : prev;
    });
  }, []);

  if (collapsed) {
    return (
      <div
        id={navId}
        className="flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2 pt-2 pb-4"
      >
        {navCategories.map((category) => (
          <CollapsedCategoryFlyout
            key={category.id}
            category={category}
            currentPage={currentPage}
            activeCategoryId={activeCategoryId}
            isOpen={openCategoryId === category.id}
            onOpenChange={(open) => handleFlyoutOpenChange(category.id, open)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div id={navId} className="flex-1 overflow-y-auto px-3 pt-2">
      <div className="flex flex-col">
        {navCategories.map((category, index) => {
          const isCategoryOpen = openCategories.has(category.id);
          return (
            <Collapsible
              key={category.id}
              open={isCategoryOpen}
              onOpenChange={(open) => onCategoryOpenChange(category.id, open)}
              className={index > 0 ? 'mt-1' : undefined}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="group mb-1.5 flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 py-0 hover:bg-transparent dark:hover:bg-transparent"
                >
                  <SubtleSectionHeading
                    title={category.title}
                    icon={category.icon}
                    className="min-w-0 flex-1 translate-y-px"
                  />
                  {isCategoryOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 translate-y-px text-slate-300 transition-colors group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 translate-y-px text-slate-300 transition-colors group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <nav className="flex flex-col items-stretch gap-[2px] pb-1 pl-6">
                  {category.items.map((item) => {
                    const activeSubPage =
                      item.submenu?.some((s) => s.page === currentPage) === true
                        ? currentPage
                        : null;
                    const isItemActive = item.page === currentPage || activeSubPage !== null;
                    const submenuOpen = computeSubmenuOpen(
                      item,
                      currentPage,
                      userOpenSubmenus,
                      userClosedSubmenus,
                    );
                    return (
                      <NavItem
                        key={item.page}
                        item={item}
                        isActive={isItemActive}
                        activeSubPage={activeSubPage}
                        isSubmenuOpen={submenuOpen}
                        onNavigate={onNavigate}
                        onSubmenuOpenChange={onSubmenuOpenChange}
                      />
                    );
                  })}
                </nav>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
});
