const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../EstimateForm.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../EstimateList.tsx'), 'utf8');
const headerSrc = fs.readFileSync(path.join(__dirname, '../EstimateDetailHeaderMenus.tsx'), 'utf8');

describe('EstimateForm edit UX parity (Contacts-class / EstimateView shell)', () => {
  test('uses URL ?tab= with same four tabs as EstimateView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseEstimateFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/'lines'/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/sidebar=\{formSidebar\}/);
    expect(formSrc).not.toMatch(/DetailActivityLog/);
  });

  test('linked and activity tabs are greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/ESTIMATE_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('reuses invoice line editor via wrapper', () => {
    expect(formSrc).toMatch(/EstimateLineItemsEditor/);
    expect(formSrc).toMatch(/EstimateCustomerSelect/);
    expect(formSrc).toMatch(/EstimatePricingSummary/);
  });

  test('lines discount and category cards match invoice edit chrome', () => {
    expect(formSrc).toMatch(/estimates\.discount/);
    expect(formSrc).toMatch(/subtleTitle/);
    expect(formSrc).toMatch(/INVOICE_FORM_INPUT_CLASS/);
    expect(formSrc).toMatch(/invoices\.discountHelp/);
    expect(formSrc).toMatch(/DETAIL_PROP_ROW_CLASS/);
    expect(formSrc).toMatch(/FORM_GHOST_PROP_CONTROL_CLASS/);
    expect(formSrc).toMatch(/icon=\{Calculator\}/);
    expect(formSrc).toMatch(/icon=\{Eye\}/);
  });

  test('preview card exposes popup preview and send like invoices', () => {
    expect(formSrc).toMatch(/openSharedStylePreview/);
    expect(formSrc).toMatch(/openEstimatePreviewWindow/);
    expect(formSrc).toMatch(/preview:\s*openSharedStylePreview/);
    expect(formSrc).toMatch(/estimates\.previewHelp/);
    expect(listSrc).toMatch(/showPreview/);
    expect(listSrc).toMatch(/onPreview=\{handleInlineFormPreview\}/);
  });

  test('tab error indicator maps validation fields', () => {
    expect(formSrc).toMatch(/TAB_ERROR_FIELDS/);
    expect(formSrc).toMatch(/tabHasError/);
    expect(formSrc).toMatch(/bg-destructive/);
  });

  test('list settings exits go through attemptNavigation', () => {
    expect(listSrc).toMatch(
      /onSettings:\s*\(\)\s*=>\s*attemptNavigation\(\(\)\s*=>\s*openEstimateSettings\(\)\)/,
    );
    expect(listSrc).toMatch(
      /onClick=\{\(\)\s*=>\s*attemptNavigation\(\(\)\s*=>\s*openEstimateSettings\(\)\)\}/,
    );
  });
});

describe('Estimate convert gating in header menus', () => {
  test('convert action after duplicate with amber styling and confirm dialog', () => {
    expect(headerSrc).toMatch(/convert-to-invoice/);
    expect(headerSrc).toMatch(/convertToInvoice/);
    expect(headerSrc).toMatch(/showConvertConfirm/);
    expect(headerSrc).toMatch(/text-amber-700/);
    expect(headerSrc).toMatch(/convertDisabledNotAccepted/);
    expect(headerSrc).toMatch(/disabled: isInvoiced/);
    expect(headerSrc).toMatch(/estimate\.status === 'accepted'/);
  });

  test('Export menu always has Download PDF and Share (invoice parity, soft preview safe)', () => {
    expect(headerSrc).toMatch(/exportActions/);
    expect(headerSrc).toMatch(/export-pdf/);
    expect(headerSrc).toMatch(/estimatesApi\.downloadPDF/);
    expect(headerSrc).toMatch(/openEstimateShareForItem/);
    expect(headerSrc).toMatch(/ShareDialog/);
    expect(headerSrc).not.toMatch(/detailFooterActions/);
  });
});
