import type { NavCategory, NavItemData, NavPage } from '@/core/navigation/navTypes';

export function findActiveCategoryId(
  navCategories: ReadonlyArray<NavCategory>,
  currentPage: NavPage,
): string | null {
  for (const category of navCategories) {
    for (const item of category.items) {
      if (item.page === currentPage) {
        return category.id;
      }
      if (item.submenu?.some((sub) => sub.page === currentPage)) {
        return category.id;
      }
    }
  }
  return null;
}

export function findSubmenuParentPage(
  navCategories: ReadonlyArray<NavCategory>,
  currentPage: NavPage,
): NavPage | null {
  for (const category of navCategories) {
    for (const item of category.items) {
      if (item.submenu?.some((sub) => sub.page === currentPage)) {
        return item.page;
      }
    }
  }
  return null;
}

export function isSubmenuAutoOpen(item: NavItemData, currentPage: NavPage): boolean {
  return item.submenu?.some((sub) => sub.page === currentPage) ?? false;
}

export function isSubmenuOpen(
  item: NavItemData,
  currentPage: NavPage,
  userOpenSubmenus: ReadonlySet<NavPage>,
  userClosedSubmenus: ReadonlySet<NavPage>,
): boolean {
  if (!item.submenu?.length) {
    return false;
  }
  if (userClosedSubmenus.has(item.page)) {
    return false;
  }
  return isSubmenuAutoOpen(item, currentPage) || userOpenSubmenus.has(item.page);
}
