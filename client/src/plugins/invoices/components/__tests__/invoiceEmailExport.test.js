const fs = require('fs');
const path = require('path');

const menusSrc = fs.readFileSync(path.join(__dirname, '../InvoiceDetailHeaderMenus.tsx'), 'utf8');
const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/InvoicesProvider.tsx'),
  'utf8',
);
const contextSrc = fs.readFileSync(
  path.join(__dirname, '../../context/InvoicesContext.tsx'),
  'utf8',
);

describe('Invoice email from Export', () => {
  test('provider exposes ensureInvoiceShareForItem without opening dialog', () => {
    expect(contextSrc).toMatch(/ensureInvoiceShareForItem/);
    expect(providerSrc).toMatch(/ensureInvoiceShareForItem/);
    expect(providerSrc).toMatch(
      /const share = await ensureInvoiceShareForItem\(invoice\);\s*if \(share\) \{\s*setShowInvoiceShareDialog\(true\);/s,
    );
  });

  test('export menu wires BulkEmailDialog with share link attachment', () => {
    expect(menusSrc).toMatch(/id: 'email-invoice'/);
    expect(menusSrc).toMatch(/BulkEmailDialog/);
    expect(menusSrc).toMatch(/ensureInvoiceShareForItem/);
    expect(menusSrc).toMatch(/formatInvoiceShareEmailText/);
    expect(menusSrc).toMatch(/formatInvoiceShareEmailHtml/);
    expect(menusSrc).toMatch(/pluginSource="invoices"/);
    expect(menusSrc).toMatch(/user\.plugins\.includes\('mail'\)/);
  });
});
