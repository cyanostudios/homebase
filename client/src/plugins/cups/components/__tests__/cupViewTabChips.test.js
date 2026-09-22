const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../CupView.tsx'), 'utf8');

describe('CupView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card always mounts CupDetailHeaderMenus with tab chips below', () => {
    expect(viewSrc).toMatch(/CupDetailHeaderMenus/);
    expect(viewSrc).toMatch(/DetailHeaderMetaRow/);
    expect(viewSrc).toMatch(/StatusOutlineBadge/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).not.toMatch(/sidebar=\{/);
    expect(viewSrc).not.toMatch(/stacked \?/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseCupViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/value === 'properties'/); // legacy ?tab=properties → information
    expect(viewSrc).toMatch(/'ratings'/);
    expect(viewSrc).toMatch(/'ingest'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'information' \? propertiesCard/);
    expect(viewSrc).not.toMatch(/activeTab === 'properties'/);
    expect(viewSrc).toMatch(/activeTab === 'ratings'/);
    expect(viewSrc).toMatch(/activeTab === 'ingest'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
  });

  test('information section title uses i18n tab key', () => {
    expect(viewSrc).toMatch(/t\('cups\.tabs\.information'\)/);
    expect(viewSrc).not.toMatch(/title="Cup information"/);
  });

  test('activity tab renders DetailActivityLog when selected', () => {
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/cups\.tabs\.activity/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="cup"/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
  });
});
