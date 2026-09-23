const fs = require('fs');
const path = require('path');

const menusSrc = fs.readFileSync(path.join(__dirname, '../EstimateDetailHeaderMenus.tsx'), 'utf8');
const formSrc = fs.readFileSync(path.join(__dirname, '../EstimateForm.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../EstimateView.tsx'), 'utf8');
const providerSrc = fs.readFileSync(
  path.join(__dirname, '../../context/EstimateProvider.tsx'),
  'utf8',
);

describe('Estimates parity with invoices chrome', () => {
  test('Send sits before Actions; preview has no Send', () => {
    expect(menusSrc).toMatch(/beforeActions=/);
    expect(menusSrc).toMatch(/requestStatusChange\('sent', estimate\)/);
    expect(formSrc).not.toMatch(/estimates\.send/);
    expect(viewSrc).not.toMatch(/estimates\.send/);
    expect(formSrc).toMatch(/common\.preview/);
    expect(viewSrc).toMatch(/common\.preview/);
  });

  test('Export email estimate wires share ensure + BulkEmailDialog', () => {
    expect(providerSrc).toMatch(/ensureEstimateShareForItem/);
    expect(menusSrc).toMatch(/id: 'email-estimate'/);
    expect(menusSrc).toMatch(/BulkEmailDialog/);
    expect(menusSrc).toMatch(/formatEstimateShareEmailText/);
    expect(menusSrc).toMatch(/pluginSource="estimates"/);
  });

  test('form seeds currency + VAT from contact and exposes VAT property', () => {
    expect(formSrc).toMatch(/resolveInvoiceVatRateFromContact/);
    expect(formSrc).toMatch(/INVOICE_CURRENCY_OPTIONS/);
    expect(formSrc).toMatch(/INVOICE_VAT_RATES/);
    expect(formSrc).toMatch(/estimate-vat-rate/);
    expect(formSrc).toMatch(/defaultVatRate/);
  });
});
