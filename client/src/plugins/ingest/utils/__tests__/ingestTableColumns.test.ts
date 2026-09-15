import {
  DEFAULT_INGEST_TABLE_COLUMNS,
  resolveVisibleIngestTableColumns,
} from '../ingestTableColumns';

describe('ingestTableColumns', () => {
  it('defaults to name-only visible columns', () => {
    expect(DEFAULT_INGEST_TABLE_COLUMNS.hidden).toEqual([
      'sourceType',
      'isActive',
      'lastFetchStatus',
      'lastFetchedAt',
    ]);
    expect(resolveVisibleIngestTableColumns(null)).toEqual(['name']);
    expect(
      resolveVisibleIngestTableColumns({ tableColumns: DEFAULT_INGEST_TABLE_COLUMNS }),
    ).toEqual(['name']);
  });
});
