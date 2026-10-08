/**
 * Inventory → invoice/estimate line picker is available when the tenant has
 * at least one of the invoicing document plugins enabled.
 */
export function hasInventoryInvoicingPlugins(enabledPlugins: Set<string>): boolean {
  return enabledPlugins.has('invoices') || enabledPlugins.has('estimates');
}
