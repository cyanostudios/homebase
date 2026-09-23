const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../MailProviderView.tsx'), 'utf8');
const menusSrc = fs.readFileSync(
  path.join(__dirname, '../MailProviderDetailHeaderMenus.tsx'),
  'utf8',
);

describe('MailProviderView detail Actions + stacked cards', () => {
  test('header card mounts menus with leading identity; no tab chips', () => {
    expect(viewSrc).toMatch(/MailProviderDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/DetailHeaderMetaRow/);
    expect(viewSrc).toMatch(/StatusOutlineBadge/);
    expect(viewSrc).toMatch(/mail\.tabs\.information/);
    expect(viewSrc).toMatch(/mail\.tabs\.configuration/);
    expect(viewSrc).toMatch(/mail\.tabs\.test/);
    expect(viewSrc).not.toMatch(/LIST_FILTER_CHIP/);
    expect(viewSrc).not.toMatch(/useSearchParams/);
    expect(viewSrc).not.toMatch(/activeTab/);
  });

  test('Actions includes Edit, Delete, and Send test that focuses stacked test card', () => {
    expect(menusSrc).toMatch(/leading\?:/);
    expect(menusSrc).toMatch(/onSendTest\?:/);
    expect(menusSrc).toMatch(/id: 'edit'/);
    expect(menusSrc).toMatch(/id: 'delete'/);
    expect(menusSrc).toMatch(/id: 'send-test'/);
    expect(menusSrc).toMatch(/onClick: onSendTest/);
    expect(menusSrc).not.toMatch(/next\.set\('tab'/);
    expect(viewSrc).toMatch(/onSendTest=\{/);
    expect(viewSrc).toMatch(/focusTestCard/);
  });

  test('test card uses RoundIconLabelButton for Send test email', () => {
    expect(viewSrc).toMatch(/RoundIconLabelButton/);
    expect(viewSrc).toMatch(/mail\.sendTest/);
    expect(viewSrc).toMatch(/alwaysExpanded/);
    expect(viewSrc).toMatch(/variant="primary"/);
  });
});
