const fs = require('fs');
const path = require('path');

const listSrc = fs.readFileSync(path.join(__dirname, '../MailProvidersList.tsx'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '../MailProvidersListTable.tsx'), 'utf8');

describe('MailProvidersList table view wiring', () => {
  test('list renders MailProvidersListTable for filtered providers', () => {
    expect(listSrc).toMatch(/MailProvidersListTable/);
    expect(listSrc).toMatch(/providerTitle=\{/);
    expect(listSrc).toMatch(/onRowClick=\{handleRowActivate\}/);
    expect(listSrc).toMatch(/activeProviderId=\{activeListProviderId\}/);
  });

  test('table uses name-only default with meta under provider (Contacts/AI Providers pattern)', () => {
    expect(tableSrc).toMatch(/resolveVisibleMailProvidersTableColumns/);
    expect(tableSrc).toMatch(/DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS/);
    expect(tableSrc).toMatch(/mailProviderIdentityMeta/);
    expect(tableSrc).toMatch(/SectionCategoryIcon/);
    expect(tableSrc).toMatch(/StatusOutlineBadge/);
    expect(tableSrc).toMatch(/QC_STATUS_BADGE_COLORS/);
    expect(tableSrc).toMatch(/text-slate-400/);
    expect(tableSrc).toMatch(/pl-6/);
    expect(tableSrc).toMatch(/font-extrabold leading-tight/);
    expect(tableSrc).toMatch(/text-\[10px\]/);
    expect(tableSrc).toMatch(/'provider'/);
    expect(tableSrc).toMatch(/'status'/);
    expect(tableSrc).toMatch(/'capability'/);
    expect(tableSrc).toMatch(/'credentials'/);
    expect(tableSrc).toMatch(/visibleColumnIds/);
  });
});
