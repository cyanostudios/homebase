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

  test('hides leveransdatum when showSupplyDate is false', () => {
    const html = generatePDFHTML({
      invoiceNumber: '2026-003',
      issueDate: '2026-09-01',
      supplyDate: '2026-09-15',
      showSupplyDate: false,
      dueDate: '2026-10-01',
      lineItems: [],
    });

    expect(html).not.toMatch(/Leveransdatum/);
    expect(html).not.toMatch(/2026-09-15/);
  });
});
