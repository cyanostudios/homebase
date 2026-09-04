const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

describe('Invoices statistics content view', () => {
  test('list opens statistics view and removes submenu stubs', () => {
    const listSrc = fs.readFileSync(path.join(root, 'InvoicesList.tsx'), 'utf8');
    const contextSrc = fs.readFileSync(path.join(root, '../context/InvoicesContext.tsx'), 'utf8');
    const providerSrc = fs.readFileSync(path.join(root, '../context/InvoicesProvider.tsx'), 'utf8');
    const navSrc = fs.readFileSync(path.join(root, '../navigation.ts'), 'utf8');

    expect(listSrc).toMatch(/InvoicesStatisticsView/);
    expect(listSrc).not.toMatch(/InvoicesRecurringView/);
    expect(listSrc).toMatch(/openInvoiceStatistics/);
    expect(listSrc).not.toMatch(/openInvoiceRecurring/);
    expect(listSrc).toMatch(/BarChart2/);
    expect(listSrc).not.toMatch(/invoicesNavigation\.submenu/);

    expect(contextSrc).toMatch(/'list' \| 'settings' \| 'statistics'/);
    expect(contextSrc).not.toMatch(/recurring/);
    expect(contextSrc).toMatch(/openInvoiceStatistics/);
    expect(contextSrc).toMatch(/closeInvoiceStatisticsView/);
    expect(contextSrc).not.toMatch(/openInvoiceRecurring/);

    expect(providerSrc).toMatch(/setInvoicesContentView\('statistics'\)/);
    expect(providerSrc).not.toMatch(/setInvoicesContentView\('recurring'\)/);

    expect(navSrc).not.toMatch(/submenu:/);
  });
});
