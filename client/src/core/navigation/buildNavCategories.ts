import { NAV_CATEGORIES } from '@/core/navigation/categoryConfig';
import { CORE_SIDEBAR_NAV_ITEMS } from '@/core/navigation/coreNavItems';
import type { NavCategory, NavItemData, NavPage, NavTranslate } from '@/core/navigation/navTypes';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

export function buildNavCategories(
  enabledPlugins: ReadonlySet<string>,
  t: NavTranslate,
): NavCategory[] {
  const categoriesMap = new Map<string, NavItemData[]>();

  for (const coreItem of CORE_SIDEBAR_NAV_ITEMS) {
    if (!categoriesMap.has(coreItem.categoryId)) {
      categoriesMap.set(coreItem.categoryId, []);
    }
    categoriesMap.get(coreItem.categoryId)!.push({
      label: t(`nav.${coreItem.page}`),
      icon: coreItem.icon,
      page: coreItem.page,
      order: coreItem.order,
    });
  }

  PLUGIN_REGISTRY.forEach((plugin) => {
    if (!enabledPlugins.has(plugin.name) || !plugin.navigation) {
      return;
    }

    const { category, icon, order, submenu, badge } = plugin.navigation;
    if (!categoriesMap.has(category)) {
      categoriesMap.set(category, []);
    }

    const sortedSubmenu = submenu
      ? [...submenu]
          .sort((a, b) => a.order - b.order)
          .map((sub) => ({
            label: t(`nav.${sub.page}`),
            icon: sub.icon,
            page: sub.page as NavPage,
            order: sub.order,
          }))
      : undefined;

    categoriesMap.get(category)!.push({
      label: t(`nav.${plugin.name}`),
      icon,
      page: plugin.name as NavPage,
      order,
      badge,
      submenu: sortedSubmenu,
    });
  });

  categoriesMap.forEach((items) => {
    items.sort((a, b) => a.order - b.order);
  });

  return NAV_CATEGORIES.filter(({ id }) => categoriesMap.has(id)).map(({ id, i18nKey }) => ({
    id,
    title: t(`nav.${i18nKey}`),
    items: categoriesMap.get(id)!,
  }));
}
