const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../PublicEstimateView.tsx'), 'utf8');
const invoiceSrc = fs.readFileSync(
  path.join(__dirname, '../../../invoices/components/PublicInvoiceView.tsx'),
  'utf8',
);

describe('PublicEstimateView share window header', () => {
  test('matches invoice public header chrome (bar + PDF download)', () => {
    expect(viewSrc).toMatch(/fixed inset-0 flex flex-col/);
    expect(viewSrc).toMatch(/border-b border-border\/60/);
    expect(viewSrc).toMatch(/Giltig t\.o\.m\./);
    expect(viewSrc).toMatch(/Ladda ner PDF/);
    expect(viewSrc).toMatch(/downloadPublicPdf/);
    expect(viewSrc).toMatch(/formatEstimateStatusForDisplay/);
    expect(invoiceSrc).toMatch(/Förfallodatum/);
    expect(invoiceSrc).toMatch(/Ladda ner PDF/);
  });
});
