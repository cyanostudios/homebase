const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../InvoicesForm.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../InvoicesList.tsx'), 'utf8');
const customerSrc = fs.readFileSync(path.join(__dirname, '../InvoiceCustomerSelect.tsx'), 'utf8');

describe('InvoicesForm edit UX parity (Contacts-class / InvoicesView shell)', () => {
  test('uses URL ?tab= with same five tabs as InvoicesView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseInvoiceFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/'lines'/);
    expect(formSrc).toMatch(/'payments'/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('payments, linked and activity tabs are greyed out in edit', () => {
    expect(formSrc).toMatch(/INVOICE_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('customer select is Information-tab only; form header holds tab chips', () => {
    expect(formSrc).toMatch(/formHeader/);
    expect(formSrc).toMatch(/PLUGIN_PAGE_TITLE_CLASS/);
    expect(formSrc).toMatch(/InvoiceCustomerSelect/);
    // Customer select must not sit in the always-visible header with tab chips
    const headerBlock = formSrc.match(
      /const formHeader = \([\s\S]*?\);\s*\n\s*const formBody/,
    )?.[0];
    expect(headerBlock).toBeTruthy();
    expect(headerBlock).not.toMatch(/InvoiceCustomerSelect/);
    expect(headerBlock).toMatch(/tabChips/);
    expect(formSrc).toMatch(
      /activeTab === 'information'[\s\S]*?InvoiceCustomerSelect[\s\S]*?activeTab === 'lines'/,
    );
  });

  test('document preview lives on Information tab, not Lines', () => {
    const infoIdx = formSrc.indexOf("activeTab === 'information'");
    const linesIdx = formSrc.indexOf("activeTab === 'lines'");
    expect(infoIdx).toBeGreaterThan(-1);
    expect(linesIdx).toBeGreaterThan(infoIdx);
    const infoBlock = formSrc.slice(infoIdx, linesIdx);
    const linesBlock = formSrc.slice(linesIdx);
    expect(infoBlock).toMatch(/InvoiceDocumentPreview/);
    expect(linesBlock).not.toMatch(/InvoiceDocumentPreview/);
  });

  test('ghost fact fields; line items editor left untouched', () => {
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(formSrc).toMatch(/FORM_GHOST_PROP_CONTROL_CLASS/);
    expect(formSrc).toMatch(/FORM_GHOST_TEXTAREA_CLASS/);
    expect(formSrc).toMatch(/InvoiceLineItemsEditor/);
    expect(formSrc).toMatch(/INVOICE_FORM_INPUT_CLASS/);
    expect(customerSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(customerSrc).not.toMatch(/INVOICE_FORM_INPUT_CLASS/);
  });

  test('tab error indicator maps validation fields', () => {
    expect(formSrc).toMatch(/TAB_ERROR_FIELDS/);
    expect(formSrc).toMatch(/tabHasError/);
    expect(formSrc).toMatch(/bg-destructive/);
  });

  test('list settings exits go through attemptNavigation', () => {
    expect(listSrc).toMatch(
      /onSettings:\s*\(\)\s*=>\s*attemptNavigation\(\(\)\s*=>\s*openInvoiceSettings\(\)\)/,
    );
    expect(listSrc).toMatch(
      /onClick=\{\(\)\s*=>\s*attemptNavigation\(\(\)\s*=>\s*openInvoiceSettings\(\)\)\}/,
    );
  });
});
