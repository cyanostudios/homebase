import {
  DEFAULT_AI_PROVIDERS_TABLE_COLUMNS,
  resolveVisibleAIProvidersTableColumns,
} from '../aiProvidersTableColumns';

describe('aiProvidersTableColumns', () => {
  it('defaults to provider-only visible columns', () => {
    expect(DEFAULT_AI_PROVIDERS_TABLE_COLUMNS.hidden).toEqual(['status', 'defaultModel', 'apiKey']);
    expect(resolveVisibleAIProvidersTableColumns(null)).toEqual(['provider']);
    expect(
      resolveVisibleAIProvidersTableColumns({ tableColumns: DEFAULT_AI_PROVIDERS_TABLE_COLUMNS }),
    ).toEqual(['provider']);
  });
});
