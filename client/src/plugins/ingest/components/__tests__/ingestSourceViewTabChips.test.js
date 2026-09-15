const fs = require('fs');
const path = require('path');

const viewSrc = fs.readFileSync(path.join(__dirname, '../IngestSourceView.tsx'), 'utf8');

describe('IngestSourceView detail tab chips', () => {
  test('uses compact list filter chip tokens (same as Contacts detail tabs)', () => {
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ACTIVE_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_CLASS/);
    expect(viewSrc).toMatch(/LIST_FILTER_CHIP_ROW_CLASS/);
    expect(viewSrc).toMatch(/aria-pressed=\{isActive\}/);
    expect(viewSrc).toMatch(/h-3\.5 w-3\.5/);
  });

  test('header card always mounts IngestSourceDetailHeaderMenus with tab chips below', () => {
    expect(viewSrc).toMatch(/IngestSourceDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/<div className="mt-4">\{tabChips\}<\/div>/);
    expect(viewSrc).not.toMatch(/sidebar=\{/);
    expect(viewSrc).not.toMatch(/stacked \?/);
  });

  test('tabs use URL ?tab= with information as default', () => {
    expect(viewSrc).toMatch(/useSearchParams/);
    expect(viewSrc).toMatch(/parseIngestSourceViewTab/);
    expect(viewSrc).toMatch(/'information'/);
    expect(viewSrc).toMatch(/'excerpt'/);
    expect(viewSrc).toMatch(/'runs'/);
    expect(viewSrc).toMatch(/next\.delete\('tab'\)/);
    expect(viewSrc).toMatch(/activeTab === 'information'/);
    expect(viewSrc).toMatch(/activeTab === 'excerpt'/);
    expect(viewSrc).toMatch(/activeTab === 'runs'/);
  });

  test('information section title uses i18n tab key', () => {
    expect(viewSrc).toMatch(/t\('ingest\.tabs\.information'\)/);
  });

  test('excerpt tab always renders with empty state', () => {
    expect(viewSrc).toMatch(/ingest\.tabs\.excerptEmpty/);
    expect(viewSrc).toMatch(/DETAIL_EMPTY_STATE_CLASS/);
  });

  test('runs tab chip shows count when runs exist', () => {
    expect(viewSrc).toMatch(/runsCount/);
    expect(viewSrc).toMatch(/ingestRuns\.length > 0/);
  });
});
