const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../CupForm.tsx'), 'utf8');

describe('CupForm edit UX parity (CupView shell)', () => {
  test('uses URL ?tab= with same four tabs as CupView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseCupFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'ratings'/);
    expect(formSrc).toMatch(/'ingest'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/sidebar=\{infoSidebar\}/);
  });

  test('ratings, ingest, and activity tabs are greyed out in edit', () => {
    expect(formSrc).toMatch(/CUP_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost fact field styling', () => {
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
  });
});
