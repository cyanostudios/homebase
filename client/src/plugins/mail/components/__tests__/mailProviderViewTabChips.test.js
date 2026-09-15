const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../MailProviderView.tsx'), 'utf8');
const menusSrc = fs.readFileSync(
  path.join(__dirname, '../MailProviderDetailHeaderMenus.tsx'),
  'utf8',
);

describe('MailProviderView detail Actions + tabs', () => {
  test('header card mounts MailProviderDetailHeaderMenus with leading identity and tab chips', () => {
    expect(viewSrc).toMatch(/MailProviderDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'configuration'/);
    expect(viewSrc).toMatch(/'test'/);
  });

  test('Actions includes Edit, Delete, and Send test that opens test tab', () => {
    expect(menusSrc).toMatch(/leading\?:/);
    expect(menusSrc).toMatch(/id: 'edit'/);
    expect(menusSrc).toMatch(/id: 'delete'/);
    expect(menusSrc).toMatch(/id: 'send-test'/);
    expect(menusSrc).toMatch(/next\.set\('tab', 'test'\)/);
  });

  test('test tab uses RoundIconLabelButton for Send test email', () => {
    expect(viewSrc).toMatch(/RoundIconLabelButton/);
    expect(viewSrc).toMatch(/mail\.sendTest/);
    expect(viewSrc).toMatch(/alwaysExpanded/);
    expect(viewSrc).toMatch(/variant="primary"/);
  });
});
