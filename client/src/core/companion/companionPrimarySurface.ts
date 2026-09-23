import type { NavPage } from '@/core/navigation/navTypes';
import type { PluginRegistryEntry } from '@/core/pluginRegistry';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

/** Primary pages where the companion rail button is hidden and the flyout should close. */
export function resolveCompanionHideOnPrimaryPages(entry: PluginRegistryEntry): NavPage[] {
  if (entry.companionHideOnPrimaryPages && entry.companionHideOnPrimaryPages.length > 0) {
    return entry.companionHideOnPrimaryPages;
  }
  return [entry.name as NavPage];
}

export function shouldHideCompanionRailForPrimary(
  entry: PluginRegistryEntry,
  currentPage: NavPage,
): boolean {
  return resolveCompanionHideOnPrimaryPages(entry).includes(currentPage);
}

export function shouldCloseCompanionForPrimary(
  companionPlugin: NavPage,
  currentPage: NavPage,
  registry: PluginRegistryEntry[] = PLUGIN_REGISTRY,
): boolean {
  const entry = registry.find((plugin) => plugin.name === companionPlugin);
  if (!entry) {
    return false;
  }
  return shouldHideCompanionRailForPrimary(entry, currentPage);
}

export function resolveCompanionRailIcon(entry: PluginRegistryEntry) {
  return entry.companionRailIcon ?? entry.navigation?.icon;
}

export function resolveCompanionRailTitleNavPage(entry: PluginRegistryEntry): NavPage {
  return entry.companionRailTitleNavPage ?? (entry.name as NavPage);
}
