const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../TeamForm.tsx'), 'utf8');

describe('TeamForm edit UX parity (TeamView shell)', () => {
  test('uses URL ?tab= with TeamView tab ids', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseTeamFormTab/);
    expect(formSrc).toMatch(/'overview'/);
    expect(formSrc).toMatch(/'schedule'/);
    expect(formSrc).toMatch(/'seriesTeams'/);
    expect(formSrc).toMatch(/'responsibles'/);
    expect(formSrc).toMatch(/'notes'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('does not use leftSidebar two-column stack', () => {
    expect(formSrc).not.toMatch(/DETAIL_INFO_ROW_CLASS/);
    expect(formSrc).not.toMatch(/formatDisplayNumber/);
  });

  test('view-only tabs are greyed out in edit', () => {
    expect(formSrc).toMatch(/TEAM_FORM_EDIT_DISABLED_TABS/);
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
