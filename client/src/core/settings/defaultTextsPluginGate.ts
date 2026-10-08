/**
 * Default texts (Settings) are only relevant when invoice and/or estimate
 * plugins are enabled for the tenant.
 */

export function hasDefaultTextsPlugins(enabledPlugins: Set<string> | Iterable<string>): boolean {
  const set = enabledPlugins instanceof Set ? enabledPlugins : new Set(enabledPlugins);
  return set.has('invoices') || set.has('estimates');
}

export function showDefaultTextsInvoiceMail(
  enabledPlugins: Set<string> | Iterable<string>,
): boolean {
  const set = enabledPlugins instanceof Set ? enabledPlugins : new Set(enabledPlugins);
  return set.has('invoices');
}

export function showDefaultTextsEstimateMail(
  enabledPlugins: Set<string> | Iterable<string>,
): boolean {
  const set = enabledPlugins instanceof Set ? enabledPlugins : new Set(enabledPlugins);
  return set.has('estimates');
}
