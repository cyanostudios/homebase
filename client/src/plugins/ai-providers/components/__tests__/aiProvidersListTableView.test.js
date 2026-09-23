const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../AIProvidersListTable.tsx'), 'utf8');
const viewSrc = fs.readFileSync(path.join(__dirname, '../AIProviderView.tsx'), 'utf8');

describe('AIProvidersList table view wiring', () => {
  test('list renders AIProvidersListTable for filtered providers', () => {
    expect(listSrc).toMatch(/AIProvidersListTable/);
    expect(listSrc).toMatch(/providerTitle=\{/);
    expect(listSrc).toMatch(/onRowClick=\{handleRowActivate\}/);
    expect(listSrc).toMatch(/activeProviderId=\{activeListProviderId\}/);
  });

  test('table uses name-only default with meta under provider (Contacts/Ingest pattern)', () => {
    expect(tableSrc).toMatch(/resolveVisibleAIProvidersTableColumns/);
    expect(tableSrc).toMatch(/DEFAULT_AI_PROVIDERS_TABLE_COLUMNS/);
    expect(tableSrc).toMatch(/aiProviderIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6 text-\[10px\]/);
    expect(tableSrc).toMatch(/'provider'/);
    expect(tableSrc).toMatch(/'status'/);
    expect(tableSrc).toMatch(/'defaultModel'/);
    expect(tableSrc).toMatch(/'apiKey'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });

  test('detail view embeds AIProviderDetailHeaderMenus with leading identity (stacked cards, no tabs)', () => {
    expect(viewSrc).toMatch(/AIProviderDetailHeaderMenus/);
    expect(viewSrc).toMatch(/leading=\{titleLeading\}/);
    expect(viewSrc).toMatch(/gridClassName="grid-cols-1"/);
    expect(viewSrc).toMatch(/DetailHeaderMetaRow/);
    expect(viewSrc).toMatch(/StatusOutlineBadge/);
    expect(viewSrc).not.toMatch(/useSearchParams/);
    expect(listSrc).not.toMatch(/AIProviderDetailHeaderMenus/);
  });

  test('table status uses StatusOutlineBadge (Tasks/Mail/Pulse pattern)', () => {
    expect(tableSrc).toMatch(/StatusOutlineBadge/);
    expect(tableSrc).toMatch(/QC_STATUS_BADGE_COLORS/);
    expect(tableSrc).not.toMatch(/from '@\/components\/ui\/badge'/);
  });
});
