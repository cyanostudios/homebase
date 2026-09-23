const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../AIProviderView.tsx'), 'utf8');
const menusSrc = fs.readFileSync(
  path.join(__dirname, '../AIProviderDetailHeaderMenus.tsx'),
  'utf8',
);

describe('AIProviderView detail Actions + stacked cards', () => {
  test('header card mounts menus with leading identity; no tab chips', () => {
    expect(viewSrc).toMatch(/AIProviderDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/DetailHeaderMetaRow/);
    expect(viewSrc).toMatch(/StatusOutlineBadge/);
    expect(viewSrc).toMatch(/aiProviders\.tabs\.information/);
    expect(viewSrc).toMatch(/aiProviders\.tabs\.configuration/);
    expect(viewSrc).toMatch(/aiProviders\.tabs\.test/);
    expect(viewSrc).not.toMatch(/LIST_FILTER_CHIP/);
    expect(viewSrc).not.toMatch(/useSearchParams/);
    expect(viewSrc).not.toMatch(/activeTab/);
  });

  test('Actions includes Edit, Delete, and Test connection that focuses stacked test card', () => {
    expect(menusSrc).toMatch(/leading\?:/);
    expect(menusSrc).toMatch(/onTestConnection\?:/);
    expect(menusSrc).toMatch(/id: 'edit'/);
    expect(menusSrc).toMatch(/id: 'delete'/);
    expect(menusSrc).toMatch(/id: 'test-connection'/);
    expect(menusSrc).toMatch(/onFocusTestCard/);
    expect(menusSrc).not.toMatch(/next\.set\('tab'/);
    expect(viewSrc).toMatch(/onTestConnection=\{/);
    expect(viewSrc).toMatch(/focusTestCard/);
  });
});
