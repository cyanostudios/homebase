import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';

/**
 * Plugins whose List may open as a global companion flyout on the right rail
 * (desktop). Source of truth: presence of `canOpenAsCompanionFor` + tenant enablement + List.
 * Host entries in `canOpenAsCompanionFor` are reserved/ignored — companion is platform-wide.
 */
export function getCompanionCandidates(
  enabledPlugins: Set<string>,
  registry: PluginRegistryEntry[] = PLUGIN_REGISTRY,
): PluginRegistryEntry[] {
  return registry.filter(
    (entry) =>
      enabledPlugins.has(entry.name) &&
      Boolean(entry.components.List) &&
      Boolean(entry.canOpenAsCompanionFor && entry.canOpenAsCompanionFor.length > 0),
  );
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
