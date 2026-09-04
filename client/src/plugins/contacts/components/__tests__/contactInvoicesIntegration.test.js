const fs = require('fs');
const path = require('path');

const linkedSrc = fs.readFileSync(path.join(__dirname, '../ContactLinkedItemsSection.tsx'), 'utf8');
const quickContextSrc = fs.readFileSync(
  path.join(__dirname, '../ContactQuickContextPanel.tsx'),
  'utf8',
);
const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/ContactProvider.tsx'),
  'utf8',
);

describe('Contact invoices integration', () => {
  test('linked section loads and opens invoices for the contact', () => {
    expect(linkedSrc).toMatch(/hasInvoicesPlugin/);
    expect(linkedSrc).toMatch(/invoicesApi/);
    expect(linkedSrc).toMatch(/getItems\(\)/);
    expect(linkedSrc).toMatch(/invoice\.contactId/);
    expect(linkedSrc).toMatch(/linkedInvoices/);
    expect(linkedSrc).toMatch(/openInvoiceForView/);
    expect(linkedSrc).toMatch(/contacts\.openInvoice/);
  });

  test('quick context shows at most two linked tiles', () => {
    expect(quickContextSrc).toMatch(/previewLimit=\{2\}/);
    expect(quickContextSrc).toMatch(/hideWhenEmpty/);
  });

  test('Actions menu can create invoice with contact prefill', () => {
    expect(providerSrc).toMatch(/canCreateInvoice/);
    expect(providerSrc).toMatch(/requestInvoiceCreateFromContact/);
    expect(providerSrc).not.toMatch(/useInvoices/);
    expect(providerSrc).toMatch(/contacts\.actionInvoice/);
    expect(providerSrc).toMatch(/create-invoice/);
    expect(providerSrc).toMatch(/contactId: String\(item\.id\)/);
    expect(providerSrc).toMatch(/paymentTerms: item\.paymentTerms/);
  });
});
