const fs = require('fs');
const path = require('path');

const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/InvoicesProvider.tsx'),
  'utf8',
);
const formSrc = fs.readFileSync(path.join(__dirname, '../InvoicesForm.tsx'), 'utf8');
const contextSrc = fs.readFileSync(
  path.join(__dirname, '../../context/InvoicesContext.tsx'),
  'utf8',
);

describe('Invoice create from contact', () => {
  test('provider exposes openInvoiceForCreate and defers consume until open', () => {
    expect(contextSrc).toMatch(/openInvoiceForCreate/);
    expect(contextSrc).toMatch(/InvoiceCreatePrefill/);
    expect(contextSrc).toMatch(/invoiceCreatePrefill/);

    expect(providerSrc).toMatch(/subscribeInvoiceCreateRequests/);
    expect(providerSrc).toMatch(/flushPendingInvoiceCreate/);
    expect(providerSrc).toMatch(/setPendingInvoiceCreate/);
    expect(providerSrc).toMatch(/hasPendingInvoiceCreate/);
    expect(providerSrc).toMatch(/peekPendingInvoiceCreate/);
    expect(providerSrc).toMatch(/takePendingInvoiceCreate/);
    expect(providerSrc).toMatch(/clearPendingInvoiceCreate/);
    expect(providerSrc).toMatch(/openInvoiceForCreate/);
    expect(providerSrc).toMatch(/navigate\('\/invoices'\)/);

    // Open from peek; take deferred so Strict Mode remount still sees pending.
    expect(providerSrc).toMatch(/peekPendingInvoiceCreate\(\)/);
    expect(providerSrc).toMatch(
      /openCreateInvoicePanelRef\.current\(pending \?\? null\);\s*const timer = window\.setTimeout\(\(\) => \{\s*takePendingInvoiceCreate\(\);/s,
    );
  });

  test('form applies invoiceCreatePrefill when creating', () => {
    expect(formSrc).toMatch(/invoiceCreatePrefill/);
    expect(formSrc).toMatch(/invoiceCreatePrefill\?\.contactId/);
    expect(formSrc).toMatch(/invoiceCreatePrefill\?\.paymentTerms/);
  });
});
