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

  test('uses EstimateQuickContextPanel with tab chips in headerBelow', () => {
    expect(viewSrc).toMatch(/EstimateQuickContextPanel/);
    expect(viewSrc).toMatch(/headerBelow=\{tabChips\}/);
    expect(viewSrc).not.toMatch(
      /EstimateDetailHeaderMenus estimate=\{estimate\} leading=\{titleLeading\}/,
    );
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseEstimateViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'lines'/);
    expect(viewSrc).toMatch(/'linked'/);
    expect(viewSrc).toMatch(/'activity'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'lines'/);
    expect(viewSrc).toMatch(/activeTab === 'linked'/);
    expect(viewSrc).toMatch(/activeTab === 'activity'/);
    expect(viewSrc).toMatch(/DetailActivityLog/);
    expect(viewSrc).toMatch(/entityType="estimate"/);
  });

  test('notes live on information tab (callout), not a separate tab', () => {
    expect(viewSrc).toMatch(/DETAIL_NOTE_CALLOUT_CLASS/);
    expect(viewSrc).not.toMatch(/activeTab === 'notes'/);
  });

  test('invoiced status locks status select', () => {
    expect(viewSrc).toMatch(/disabled=\{isInvoiced\}/);
  });

  test('linked tiles use Contacts-style half-width grid (md:grid-cols-2)', () => {
    expect(viewSrc).toMatch(/QuickContextLinkTileGrid/);
    expect(viewSrc).not.toMatch(/QuickContextLinkTileGrid className=\{stacked \? 'md:grid-cols-1'/);
  });

  test('linked invoice opens quick-info popup before navigating', () => {
    expect(viewSrc).toMatch(/AssignmentQuickInfoDialog/);
    expect(viewSrc).toMatch(/setViewingInvoice/);
    expect(viewSrc).toMatch(/contacts\.openInvoice/);
    expect(viewSrc).not.toMatch(
      /linkedInvoice && enabledPlugins\.has\('invoices'\)[\s\S]*?onClick=\{\(\) => \{\s*navigate\(/,
    );
  });
});
