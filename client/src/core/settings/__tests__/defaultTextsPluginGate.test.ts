import {
  hasDefaultTextsPlugins,
  showDefaultTextsEstimateMail,
  showDefaultTextsInvoiceMail,
} from '../defaultTextsPluginGate';

describe('defaultTextsPluginGate', () => {
  test('hides default texts when neither invoices nor estimates is enabled', () => {
    expect(hasDefaultTextsPlugins(new Set(['settings', 'contacts']))).toBe(false);
    expect(showDefaultTextsInvoiceMail(new Set(['settings']))).toBe(false);
    expect(showDefaultTextsEstimateMail(new Set(['settings']))).toBe(false);
  });

  test('shows category and invoice field when only invoices is enabled', () => {
    const plugins = new Set(['invoices', 'settings']);
    expect(hasDefaultTextsPlugins(plugins)).toBe(true);
    expect(showDefaultTextsInvoiceMail(plugins)).toBe(true);
    expect(showDefaultTextsEstimateMail(plugins)).toBe(false);
  });

  test('shows category and estimate field when only estimates is enabled', () => {
    const plugins = new Set(['estimates', 'settings']);
    expect(hasDefaultTextsPlugins(plugins)).toBe(true);
    expect(showDefaultTextsInvoiceMail(plugins)).toBe(false);
    expect(showDefaultTextsEstimateMail(plugins)).toBe(true);
  });

  test('shows both fields when invoices and estimates are enabled', () => {
    const plugins = new Set(['invoices', 'estimates', 'settings']);
    expect(hasDefaultTextsPlugins(plugins)).toBe(true);
    expect(showDefaultTextsInvoiceMail(plugins)).toBe(true);
    expect(showDefaultTextsEstimateMail(plugins)).toBe(true);
  });
});
