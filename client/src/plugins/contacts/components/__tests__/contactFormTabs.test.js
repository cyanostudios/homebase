const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../ContactForm.tsx'), 'utf8');
const useItemUrlSrc = fs.readFileSync(
  path.join(__dirname, '../../../../core/hooks/useItemUrl.ts'),
  'utf8',
);

describe('ContactForm detail tabs (same shell as View)', () => {
  test('uses URL ?tab= with same five tabs as ContactView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseContactFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'addresses'/);
    expect(formSrc).toMatch(/'persons'/);
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
    expect(formSrc).toMatch(/CONTACT_FORM_EDIT_DISABLED_TABS/);
    expect(formSrc).toMatch(/opacity-40/);
    expect(formSrc).toMatch(/disabled=\{isDisabled\}/);
    expect(formSrc).not.toMatch(/ContactLinkedItemsSection/);
    expect(formSrc).not.toMatch(/DetailActivityLog/);
  });

  test('create/edit registers global leave guard for list and sidebar navigation', () => {
    expect(formSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(formSrc).toMatch(/force:\s*true/);
  });

  test('tab error indicator maps validation fields', () => {
    expect(formSrc).toMatch(/TAB_ERROR_FIELDS/);
    expect(formSrc).toMatch(/tabHasError/);
    expect(formSrc).toMatch(/bg-destructive/);
  });

  test('navigateToItem preserves query string for View→Edit tab retention', () => {
    expect(useItemUrlSrc).toMatch(/window\.location\.search/);
    expect(useItemUrlSrc).toMatch(/Preserve query/);
  });
});
