const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../RequestForm.tsx'), 'utf8');

describe('RequestForm edit UX parity (ContactForm / RequestView shell)', () => {
  test('uses URL ?tab= with same tabs as RequestView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseRequestFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'assignees'/);
    expect(formSrc).toMatch(/'files'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/leftSidebar=\{/);
    expect(formSrc).not.toMatch(/formLeftSidebar/);
  });

  test('activity tab is greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/REQUEST_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
    expect(formSrc).not.toMatch(/DetailActivityLog/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost field styles and detail title input', () => {
    expect(formSrc).toMatch(/FORM_GHOST_TEXTAREA_CLASS/);
    expect(formSrc).toMatch(/DETAIL_FORM_TITLE_INPUT_CLASS/);
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(formSrc).toMatch(/syncTextareaHeight/);
  });
});
