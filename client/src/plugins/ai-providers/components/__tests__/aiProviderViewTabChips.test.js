const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../AIProviderView.tsx'), 'utf8');

describe('AIProviderView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card always mounts AIProviderDetailHeaderMenus with tab chips below', () => {
    expect(viewSrc).toMatch(/AIProviderDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).not.toMatch(/sidebar=\{/);
    expect(viewSrc).not.toMatch(/stacked \?/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseAIProviderViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'configuration'/);
    expect(viewSrc).toMatch(/'test'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'configuration'/);
    expect(viewSrc).toMatch(/activeTab === 'test'/);
  });

  test('information section title uses i18n tab key', () => {
    expect(viewSrc).toMatch(/t\('aiProviders\.tabs\.information'\)/);
  });

  test('test tab always renders with empty state', () => {
    expect(viewSrc).toMatch(/aiProviders\.tabs\.testEmpty/);
    expect(viewSrc).toMatch(/DETAIL_EMPTY_STATE_CLASS/);
  });
});

describe('AIProviderDetailHeaderMenus test connection opens test tab', () => {
  const menusSrc = fs.readFileSync(
    path.join(__dirname, '../AIProviderDetailHeaderMenus.tsx'),
    'utf8',
  );

  test('Actions Test connection sets ?tab=test then runs connection test', () => {
    expect(menusSrc).toMatch(/useSearchParams/);
    expect(menusSrc).toMatch(/next\.set\('tab', 'test'\)/);
    expect(menusSrc).toMatch(/openTestTab\(\)/);
    expect(menusSrc).toMatch(/handleTestConnection\(provider\)/);
    expect(menusSrc).toMatch(/onClick: onTestConnection/);
  });
});
