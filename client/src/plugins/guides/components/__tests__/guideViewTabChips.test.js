const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../GuideView.tsx'), 'utf8');

describe('GuideView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card mounts guide title with tab chips below', () => {
    expect(viewSrc).toMatch(/titleLeading/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).toMatch(/sidebar=\{/);
  });

  test('tabs use URL ?tab= with details as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseGuideViewTab/);
    expect(viewSrc).toMatch(/'details'/);
    expect(viewSrc).toMatch(/'presentations'/);
    expect(viewSrc).toMatch(/'review'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'details'/);
    expect(viewSrc).toMatch(/activeTab === 'presentations'/);
    expect(viewSrc).toMatch(/activeTab === 'review'/);
  });

  test('section titles use i18n tab keys', () => {
    expect(viewSrc).toMatch(/t\('guides\.tabs\.details'\)/);
    expect(viewSrc).toMatch(/t\('guides\.tabs\.presentations'\)/);
    expect(viewSrc).toMatch(/t\('guides\.tabs\.review'\)/);
    expect(viewSrc).toMatch(/t\('guides\.tabs\.reviewEmpty'\)/);
  });

  test('presentations tab shows count badge when presentations exist', () => {
    expect(viewSrc).toMatch(/presentationsCount/);
    expect(viewSrc).toMatch(/presentations\.length > 0/);
  });
});
