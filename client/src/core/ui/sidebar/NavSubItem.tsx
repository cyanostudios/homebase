import React, { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import type { NavPage, SubmenuNavItem } from '@/core/navigation/navTypes';
import {
  getNavItemButtonClass,
  getNavItemIconClass,
  getNavItemLabelClass,
} from '@/core/ui/sidebar/navItemStyles';

export const NavSubItem = React.memo(function NavSubItem({
  item,
  isActive,
  onNavigate,
}: {
  item: SubmenuNavItem;
  isActive: boolean;
  onNavigate: (page: NavPage) => void;
}) {
  const SubIcon = item.icon;
  const handleClick = useCallback(() => {
    onNavigate(item.page);
  }, [onNavigate, item.page]);

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={handleClick}
      className={getNavItemButtonClass(isActive)}
      aria-current={isActive ? 'page' : undefined}
    >
      <SubIcon className={getNavItemIconClass(isActive)} />
      <span className={getNavItemLabelClass(isActive)}>{item.label}</span>
    </Button>
  );
});
