const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../PriceListView.tsx'), 'utf8');

describe('PriceListView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card always mounts PriceListDetailHeaderMenus with tab chips below', () => {
    expect(viewSrc).toMatch(/PriceListDetailHeaderMenus/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).not.toMatch(/sidebar=\{/);
    expect(viewSrc).not.toMatch(/stacked \?/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parsePriceListViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'items'/);
    expect(viewSrc).toMatch(/'currency'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'items'/);
    expect(viewSrc).toMatch(/activeTab === 'currency'/);
  });

  test('items tab count uses items length', () => {
    expect(viewSrc).toMatch(/viewItem\?\.items\?\.length/);
    expect(viewSrc).toMatch(/count: itemsCount/);
  });

  test('currency moved from sidebar into tab content', () => {
    expect(viewSrc).toMatch(/currencyCard/);
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.currency'\)/);
    expect(viewSrc).not.toMatch(/currencySidebar/);
  });

  test('section titles use i18n tab keys', () => {
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.information'\)/);
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.items'\)/);
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.currency'\)/);
  });
});
