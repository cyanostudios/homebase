import { hasInventoryInvoicingPlugins } from '../inventoryInvoicingGate';

describe('hasInventoryInvoicingPlugins', () => {
  test('false when neither invoices nor estimates', () => {
    expect(hasInventoryInvoicingPlugins(new Set(['garments', 'clubdesk']))).toBe(false);
  });

  test('true when invoices enabled', () => {
    expect(hasInventoryInvoicingPlugins(new Set(['invoices']))).toBe(true);
  });

  test('true when estimates enabled', () => {
    expect(hasInventoryInvoicingPlugins(new Set(['estimates']))).toBe(true);
  });

  test('true when both enabled', () => {
    expect(hasInventoryInvoicingPlugins(new Set(['invoices', 'estimates']))).toBe(true);
  });
});
