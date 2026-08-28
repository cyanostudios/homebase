import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { NavItemData, NavPage } from '@/core/navigation/navTypes';
import { NavSubItem } from '@/core/ui/sidebar/NavSubItem';
import {
  getNavItemButtonClass,
  getNavItemIconClass,
  getNavItemLabelClass,
} from '@/core/ui/sidebar/navItemStyles';
import { cn } from '@/lib/utils';

export const NavItem = React.memo(function NavItem({
  item,
  isActive,
  activeSubPage,
  isSubmenuOpen,
  onNavigate,
  onSubmenuOpenChange,
}: {
  item: NavItemData;
  isActive: boolean;
  activeSubPage: NavPage | null;
  isSubmenuOpen: boolean;
  onNavigate: (page: NavPage) => void;
  onSubmenuOpenChange: (page: NavPage, open: boolean) => void;
}) {
  const Icon = item.icon;
  const hasSubmenu = Boolean(item.submenu && item.submenu.length > 0);

  const handleNavigateTop = useCallback(() => {
    onNavigate(item.page);
  }, [onNavigate, item.page]);

  const handleSubmenuOpenChange = useCallback(
    (open: boolean) => {
      onSubmenuOpenChange(item.page, open);
    },
    [onSubmenuOpenChange, item.page],
  );

  const buttonClass = getNavItemButtonClass(isActive);

  const content = (
    <>
      <Icon className={getNavItemIconClass(isActive)} />
      <span className={getNavItemLabelClass(isActive)}>{item.label}</span>
      {item.badge && (
        <Badge variant={item.badge.variant} className="ml-auto">
          {item.badge.label}
        </Badge>
      )}
      {hasSubmenu &&
        (isSubmenuOpen ? (
          <ChevronDown className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
        ) : (
          <ChevronRight className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
        ))}
    </>
  );

  if (hasSubmenu && item.submenu) {
    return (
      <Collapsible open={isSubmenuOpen} onOpenChange={handleSubmenuOpenChange} className="w-full">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            className={buttonClass}
            aria-current={isActive ? 'page' : undefined}
          >
            {content}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-6 pt-1 pb-1 space-y-1">
            {item.submenu.map((subItem) => (
              <NavSubItem
                key={subItem.page}
                item={subItem}
                isActive={activeSubPage !== null && subItem.page === activeSubPage}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={handleNavigateTop}
      className={buttonClass}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </Button>
  );
});
