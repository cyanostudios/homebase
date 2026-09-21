const fs = require('fs');
const path = require('path');

const formSrc = fs.readFileSync(path.join(__dirname, '../ClubdeskForm.tsx'), 'utf8');
const priceListSrc = fs.readFileSync(path.join(__dirname, '../PriceListForm.tsx'), 'utf8');

describe('ClubdeskGuideForm edit UX parity (ClubdeskView shell)', () => {
  test('uses URL ?tab= with same three tabs as ClubdeskView', () => {
    expect(formSrc).toMatch(/useSearchParams/);
    expect(formSrc).toMatch(/parseClubdeskFormTab/);
    expect(formSrc).toMatch(/'information'/);
    expect(formSrc).toMatch(/value === 'properties'/);
    expect(formSrc).toMatch(/activeTab === 'information'/);
    expect(formSrc).toMatch(/'steps'/);
    expect(formSrc).toMatch(/'activity'/);
    expect(formSrc).toMatch(/next\.delete\('tab'\)/);
    expect(formSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('activity tab is greyed out in edit', () => {
    expect(formSrc).toMatch(/CLUBDESK_FORM_EDIT_DISABLED_TABS/);
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

describe('PriceListForm edit UX parity (PriceListView shell)', () => {
  test('uses URL ?tab= with same three tabs as PriceListView', () => {
    expect(priceListSrc).toMatch(/useSearchParams/);
    expect(priceListSrc).toMatch(/parsePriceListFormTab/);
    expect(priceListSrc).toMatch(/'information'/);
    expect(priceListSrc).toMatch(/value === 'properties'/);
    expect(priceListSrc).toMatch(/activeTab === 'information'/);
    expect(priceListSrc).toMatch(/'items'/);
    expect(priceListSrc).toMatch(/'activity'/);
    expect(priceListSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
  });

  test('activity tab is greyed out in edit', () => {
    expect(priceListSrc).toMatch(/PRICE_LIST_FORM_EDIT_DISABLED_TABS/);
    expect(priceListSrc).toMatch(/opacity-40/);
  });

  test('create/edit registers global leave guard', () => {
    expect(priceListSrc).toMatch(/registerUnsavedChangesChecker\(formKey, \(\) => true\)/);
    expect(priceListSrc).toMatch(/force:\s*true/);
  });
});
