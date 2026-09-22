const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../MatchForm.tsx'), 'utf8');

describe('MatchForm edit UX parity (MatchView shell)', () => {
  test('uses URL ?tab= with same four tabs as MatchView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseMatchFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'contacts'/);
    expect(formSrc).toMatch(/'linked'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/sidebar=\{formSidebar\}/);
    expect(formSrc).not.toMatch(/leftSidebar=\{/);
  });

  test('linked and activity tabs are greyed out and not selectable in edit', () => {
    expect(formSrc).toMatch(/MATCH_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('ghost fact field styling', () => {
    expect(formSrc).toMatch(/FORM_GHOST_INPUT_CLASS/);
    expect(formSrc).not.toMatch(/FORM_INPUT_CLASS(?!_ERROR)/);
  });
});
