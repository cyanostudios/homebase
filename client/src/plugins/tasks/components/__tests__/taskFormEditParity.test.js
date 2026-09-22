const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../TaskForm.tsx'), 'utf8');

describe('TaskForm edit UX parity (ContactForm / TaskView shell)', () => {
  test('uses URL ?tab= with same five tabs as TaskView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseTaskFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'assignees'/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/leftSidebar=\{/);
    expect(formSrc).not.toMatch(/formLeftSidebar/);
  });

  test('linked and activity tabs are greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/TASK_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost title and description styling', () => {
    expect(formSrc).toMatch(/DETAIL_FORM_TITLE_INPUT_CLASS/);
    expect(formSrc).toMatch(/variant="ghost"/);
    expect(formSrc).not.toMatch(/FORM_INPUT_CLASS/);
  });

  test('tab error indicator maps validation fields', () => {
    expect(formSrc).toMatch(/TAB_ERROR_FIELDS/);
    expect(formSrc).toMatch(/tabHasError/);
    expect(formSrc).toMatch(/bg-destructive/);
  });
});
