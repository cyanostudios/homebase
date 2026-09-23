import { NAV_CATEGORIES } from '@/core/navigation/categoryConfig';
import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';

function companionNavSortKey(entry: PluginRegistryEntry): [number, number, string] {
  const categoryId = entry.navigation?.category;
  const categoryIndex = categoryId
    ? NAV_CATEGORIES.findIndex((category) => category.id === categoryId)
    : NAV_CATEGORIES.length;
  const order = entry.navigation?.order ?? Number.MAX_SAFE_INTEGER;
  return [categoryIndex < 0 ? NAV_CATEGORIES.length : categoryIndex, order, entry.name];
}

/**
 * Plugins whose List may open as a global companion flyout on the right rail
 * (desktop). Source of truth: presence of `canOpenAsCompanionFor` + tenant enablement + List.
 * Host entries in `canOpenAsCompanionFor` are reserved/ignored — companion is platform-wide.
 * Rail order matches left-nav category order, then `navigation.order` within the category.
 */
export function getCompanionCandidates(
  enabledPlugins: Set<string>,
  registry: PluginRegistryEntry[] = PLUGIN_REGISTRY,
): PluginRegistryEntry[] {
  return registry
    .filter(
      (entry) =>
        enabledPlugins.has(entry.name) &&
        Boolean(entry.components.List) &&
        Boolean(entry.canOpenAsCompanionFor && entry.canOpenAsCompanionFor.length > 0),
    )
    .sort((a, b) => {
      const [categoryA, orderA, nameA] = companionNavSortKey(a);
      const [categoryB, orderB, nameB] = companionNavSortKey(b);
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return nameA.localeCompare(nameB);
    });
}

/** True when the registry declares this plugin as companion-capable (ignores tenant enablement). */
export function isRegisteredCompanionPlugin(
  name: string,
  registry: PluginRegistryEntry[] = PLUGIN_REGISTRY,
): boolean {
  return registry.some(
    (entry) =>
      entry.name === name &&
      Boolean(entry.components.List) &&
      Boolean(entry.canOpenAsCompanionFor && entry.canOpenAsCompanionFor.length > 0),
  );
}

/** True when the plugin is companion-capable and enabled for the tenant. */
export function isCompanionEnabled(
  name: string,
  enabledPlugins: Set<string>,
  registry: PluginRegistryEntry[] = PLUGIN_REGISTRY,
): boolean {
  return enabledPlugins.has(name) && isRegisteredCompanionPlugin(name, registry);
}
