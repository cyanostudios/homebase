const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../EstimateForm.tsx'), 'utf8');
const listSrc = fs.readFileSync(path.join(__dirname, '../EstimateList.tsx'), 'utf8');

describe('EstimateForm edit UX parity (Contacts-class / EstimateView shell)', () => {
  test('uses URL ?tab= with same four tabs as EstimateView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseEstimateFormTab/);
    expect(formSrc).toMatch(/'properties'/);
    expect(formSrc).toMatch(/'lines'/);
    expect(formSrc).toMatch(/'notes'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/sidebar=\{formSidebar\}/);
    expect(formSrc).not.toMatch(/DetailActivityLog/);
  });

  test('activity tab is greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/ESTIMATE_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost fact fields; line items keep compact chrome', () => {
    expect(formSrc).toMatch(/FORM_GHOST_SELECT_CLASS/);
    expect(formSrc).toMatch(/FORM_GHOST_TEXTAREA_CLASS/);
    expect(formSrc).toMatch(/FORM_COMPACT_INPUT_CLASS/);
    expect(formSrc).not.toMatch(/FORM_INPUT_CLASS/);
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
