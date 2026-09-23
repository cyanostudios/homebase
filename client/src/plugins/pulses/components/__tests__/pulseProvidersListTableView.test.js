const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../PulseProvidersListTable.tsx'), 'utf8');

describe('PulseProvidersList table view wiring', () => {
  test('list renders PulseProvidersListTable for filtered providers', () => {
    expect(listSrc).toMatch(/PulseProvidersListTable/);
    expect(listSrc).toMatch(/providerTitle=\{/);
    expect(listSrc).toMatch(/onRowClick=\{handleRowActivate\}/);
    expect(listSrc).toMatch(/activeProviderId=\{activeListProviderId\}/);
  });

  test('table uses name-only default with meta under provider (Contacts/AI Providers pattern)', () => {
    expect(tableSrc).toMatch(/resolveVisiblePulseProvidersTableColumns/);
    expect(tableSrc).toMatch(/DEFAULT_PULSE_PROVIDERS_TABLE_COLUMNS/);
    expect(tableSrc).toMatch(/pulseProviderIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/StatusOutlineBadge/);
    expect(tableSrc).toMatch(/QC_STATUS_BADGE_COLORS/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6 text-\[10px\]/);
    expect(tableSrc).toMatch(/'provider'/);
    expect(tableSrc).toMatch(/'status'/);
    expect(tableSrc).toMatch(/'capability'/);
    expect(tableSrc).toMatch(/'credentials'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });
});
