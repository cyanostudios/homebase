const { generatePDFHTML } = require('../pdfTemplate');

describe('invoice PDF supply date', () => {
  test('shows leveransdatum and falls back to issue date when empty', () => {
    const html = generatePDFHTML({
      invoiceNumber: '2026-001',
      issueDate: '2026-09-01',
      dueDate: '2026-10-01',
      lineItems: [],
    });

    expect(html).toMatch(/Leveransdatum/);
    expect(html).toMatch(/2026-09-01/);
  });

  test('shows a distinct supply date when set', () => {
    const html = generatePDFHTML({
      invoiceNumber: '2026-002',
      issueDate: '2026-09-01',
      supplyDate: '2026-09-15',
      dueDate: '2026-10-01',
      lineItems: [],
    });

    expect(html).toMatch(/Leveransdatum/);
    expect(html).toMatch(/2026-09-15/);
  });
});
