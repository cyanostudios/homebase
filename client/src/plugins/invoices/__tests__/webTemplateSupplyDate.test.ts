import { generateInvoiceWebHTML } from '../webTemplate';

describe('invoice web preview supply date', () => {
  it('shows leveransdatum and falls back to issue date when empty', () => {
    const html = generateInvoiceWebHTML({
      id: '1',
      invoiceNumber: '2026-001',
      issueDate: '2026-09-01',
      dueDate: '2026-10-01',
      lineItems: [],
      organization: { name: 'Test AB' },
    });

    expect(html).toMatch(/Leveransdatum/);
    expect(html).toMatch(/2026-09-01/);
  });

  it('shows a distinct supply date when set', () => {
    const html = generateInvoiceWebHTML({
      id: '2',
      invoiceNumber: '2026-002',
      issueDate: '2026-09-01',
      supplyDate: '2026-09-15',
      dueDate: '2026-10-01',
      lineItems: [],
      organization: { name: 'Test AB' },
    });

    expect(html).toMatch(/Leveransdatum/);
    expect(html).toMatch(/2026-09-15/);
  });
});
