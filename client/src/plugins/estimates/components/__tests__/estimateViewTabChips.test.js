const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../EstimateView.tsx'), 'utf8');

describe('EstimateView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('mounts tabs under header card via mt-4 (no QuickContextPanel)', () => {
    expect(viewSrc).not.toMatch(/QuickContextPanel/);
    expect(viewSrc).toMatch(/EstimateDetailHeaderMenus/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).not.toMatch(/border-b border-border\/50 px-4 py-5/);
  });

  test('tabs use URL ?tab= with properties as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseEstimateViewTab/);
    expect(viewSrc).toMatch(/'properties'/);
    expect(viewSrc).toMatch(/'lines'/);
    expect(viewSrc).toMatch(/'notes'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'properties'/);
    expect(viewSrc).toMatch(/activeTab === 'lines'/);
    expect(viewSrc).toMatch(/activeTab === 'notes'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="estimate"/);
  });

  test('notes tab always renders with empty state', () => {
    expect(viewSrc).toMatch(/estimates\.tabs\.notesEmpty/);
    expect(viewSrc).toMatch(/DETAIL_EMPTY_STATE_CLASS/);
  });
});
