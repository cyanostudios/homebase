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

  test('tabs are information and items only; currency lives under information', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parsePriceListViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'items'/);
    expect(viewSrc).toMatch(
      /PRICE_LIST_VIEW_TABS: PriceListViewTab\[] = \['information', 'items'\]/,
    );
    expect(viewSrc).not.toMatch(/id: 'currency'/);
    expect(viewSrc).not.toMatch(/currencyCard/);
    expect(viewSrc).not.toMatch(/activeTab === 'currency'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'items'/);
    expect(viewSrc).toMatch(/Legacy \?tab=currency/);
  });

  test('items tab count uses items length', () => {
    expect(viewSrc).toMatch(/viewItem\?\.items\?\.length/);
    expect(viewSrc).toMatch(/count: itemsCount/);
  });

  test('currency is shown as an info row inside information', () => {
    expect(viewSrc).toMatch(/DETAIL_INFO_ROW_CLASS/);
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.currency'\)/);
    expect(viewSrc).toMatch(/viewItem\.currency \|\| 'SEK'/);
    expect(viewSrc).not.toMatch(/currencySidebar/);
  });

  test('items tab can reorder categories without entering edit', () => {
    expect(viewSrc).toMatch(/reorderPriceListCategories/);
    expect(viewSrc).toMatch(/refreshPriceListCategories/);
    expect(viewSrc).toMatch(/handleMoveCategory/);
    expect(viewSrc).toMatch(/moveCategoryUp/);
    expect(viewSrc).toMatch(/moveCategoryDown/);
    expect(viewSrc).toMatch(/reorderingCategory/);
  });

  test('each category renders as its own detail card', () => {
    expect(viewSrc).toMatch(/categoryCards/);
    expect(viewSrc).toMatch(/DETAIL_VIEW_CARD_CLASS/);
    expect(viewSrc).toMatch(/groups\.map\(\(group\) =>/);
    expect(viewSrc).toMatch(/title=\{categoryLabel\}/);
    expect(viewSrc).toMatch(/itemsEmptyCard/);
  });

  test('items use Contacts linked tile chrome and round reorder arrows', () => {
    expect(viewSrc).toMatch(/QUICK_CONTEXT_LINK_TILE_CLASS/);
    expect(viewSrc).toMatch(/DETAIL_LIST_ITEM_TITLE_CLASS/);
    expect(viewSrc).toMatch(/RoundIconLabelButton/);
    expect(viewSrc).toMatch(/expandOnHover=\{false\}/);
    expect(viewSrc).toMatch(/variant="secondary"/);
  });

  test('section titles use i18n tab keys', () => {
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.information'\)/);
    expect(viewSrc).toMatch(/t\('clubdesk\.priceList\.tabs\.items'\)/);
  });
});
