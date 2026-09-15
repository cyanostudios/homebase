import {
  DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS,
  resolveVisibleMailProvidersTableColumns,
} from '../mailProvidersTableColumns';

describe('mailProvidersTableColumns', () => {
  it('defaults to provider-only visible columns', () => {
    expect(DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS.hidden).toEqual([
      'status',
      'capability',
      'credentials',
    ]);
    expect(resolveVisibleMailProvidersTableColumns(null)).toEqual(['provider']);
    expect(
      resolveVisibleMailProvidersTableColumns({
        tableColumns: DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS,
      }),
    ).toEqual(['provider']);
  });
});
