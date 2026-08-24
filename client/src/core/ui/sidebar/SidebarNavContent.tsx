import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isSubmenuOpen as computeSubmenuOpen } from '@/core/navigation/collapsibleState';
import type { NavCategory, NavPage } from '@/core/navigation/navTypes';
import { SubtleSectionHeading } from '@/core/ui/DetailSection';
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
      <div className="flex flex-col">
        {navCategories.map((category, index) => {
          const isCategoryOpen = openCategories.has(category.id);
          return (
            <Collapsible
              key={category.id}
              open={isCategoryOpen}
              onOpenChange={(open) => onCategoryOpenChange(category.id, open)}
              className={index > 0 ? 'mt-4 border-t border-border/50 pt-3' : undefined}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="group mb-1 w-full flex h-auto items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-transparent dark:hover:bg-transparent"
                >
                  <SubtleSectionHeading
                    title={category.title}
                    icon={category.icon}
                    className="min-w-0 flex-1"
                  />
                  {isCategoryOpen ? (
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-slate-400 dark:group-hover:text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-slate-400 dark:group-hover:text-slate-500" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <nav className="flex flex-col items-stretch gap-[2px] pb-1">
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
