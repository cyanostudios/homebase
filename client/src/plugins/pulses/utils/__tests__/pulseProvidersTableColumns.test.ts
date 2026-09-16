import {
  DEFAULT_PULSE_PROVIDERS_TABLE_COLUMNS,
  resolveVisiblePulseProvidersTableColumns,
} from '../pulseProvidersTableColumns';

describe('pulseProvidersTableColumns', () => {
  it('defaults to provider-only visible columns', () => {
    expect(DEFAULT_PULSE_PROVIDERS_TABLE_COLUMNS.hidden).toEqual([
      'status',
      'capability',
      'credentials',
    ]);
    expect(resolveVisiblePulseProvidersTableColumns(null)).toEqual(['provider']);
    expect(
      resolveVisiblePulseProvidersTableColumns({
        tableColumns: DEFAULT_PULSE_PROVIDERS_TABLE_COLUMNS,
      }),
    ).toEqual(['provider']);
  });
});
