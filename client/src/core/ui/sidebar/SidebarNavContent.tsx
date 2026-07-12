import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isSubmenuOpen as computeSubmenuOpen } from '@/core/navigation/collapsibleState';
import type { NavCategory, NavPage } from '@/core/navigation/navTypes';
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
}: SidebarNavContentProps) {
  return (
    <div className="flex-1 overflow-y-auto px-3 pt-4">
      <div className="flex flex-col gap-1">
        {navCategories.map((category) => {
          const isCategoryOpen = openCategories.has(category.id);
          return (
            <Collapsible
              key={category.id}
              open={isCategoryOpen}
              onOpenChange={(open) => onCategoryOpenChange(category.id, open)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="group w-full flex items-center justify-between px-2 py-1.5 h-auto rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/50"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">
                    {category.title}
                  </span>
                  {isCategoryOpen ? (
                    <ChevronDown className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <nav className="flex flex-col items-stretch gap-[2px] pb-2 pt-0.5">
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
