import { Home } from 'lucide-react';

import type { NavCategoryId } from '@/core/navigation/categoryConfig';
import type { NavPage } from '@/core/navigation/navTypes';

/**
 * Core app pages shown in the sidebar but not registered as plugins.
 * Dashboard is the home route; settings is reached via TopBar only.
 */
export const CORE_SIDEBAR_NAV_ITEMS: ReadonlyArray<{
  page: NavPage;
  categoryId: NavCategoryId;
  icon: typeof Home;
  order: number;
}> = [{ page: 'dashboard', categoryId: 'Main', icon: Home, order: 0 }];
