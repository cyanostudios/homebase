import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

/**
 * Returns the display prefix for a plugin (e.g. CNT, NTS).
 * Used when formatting entity numbers for display (e.g. CNT-1, EST-2025-001).
 */
export function getDisplayPrefix(pluginName: string): string {
  const entry = PLUGIN_REGISTRY.find((p) => p.name === pluginName);
  return entry?.displayPrefix ?? '';
}

/**
 * Formats a number or id for display with the plugin's prefix.
 * Returns "PREFIX-number" if prefix exists, otherwise the raw number.
 * Handles empty number to avoid "PREFIX-" with nothing after.
 */
export function formatDisplayNumber(pluginName: string, numberOrId: string): string {
  const prefix = getDisplayPrefix(pluginName);
  const num = String(numberOrId ?? '').trim();
  if (!prefix) {
    return num;
  }
  if (!num) {
    return prefix;
  }
  return `${prefix}-${num}`;
}
