// plugins/cups/__tests__/createManyFromImport.test.js
const mockQuery = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();

jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {
    get: jest.fn(),
  },
}));

const { Database } = require('@homebase/core');
const CupsModel = require('../model');

beforeEach(() => {
  jest.clearAllMocks();
  Database.get.mockReturnValue({
    getUserId: () => 1,
    query: mockQuery,
    update: mockUpdate,
    insert: mockInsert,
  });
});

describe('createManyFromImport location-skip + restored', () => {
  test('location-only difference calls touchImportSeen and counts skipped', async () => {
    const model = new CupsModel();
    const existing = {
      id: 10,
      name: 'Cup A',
      organizer: 'Org',
      location: 'Manual Place',
      start_date: null,
      end_date: null,
      categories: null,
      team_count: null,
      match_format: null,
      description: null,
      registration_url: null,
      source_url: 'https://example.com',
      source_type: 'html',
      ingest_source_id: 3,
      ingest_run_id: null,
      external_id: 'cup-1',
      deleted_at: null,
    };

    // findCupIdForImportDedupe → by external_id
    mockQuery
      .mockResolvedValueOnce([{ id: 10 }]) // byExt
      .mockResolvedValueOnce([existing]) // SELECT * for existing
      .mockResolvedValueOnce([{ id: 10 }]); // touchImportSeen UPDATE

    const result = await model.createManyFromImport(
      {},
      [
        {
          name: 'Cup A',
          organizer: 'Org',
          location: 'Source Place',
          start_date: null,
          end_date: null,
          categories: null,
          team_count: null,
          match_format: null,
          description: null,
          registration_url: null,
          external_id: 'cup-1',
        },
      ],
      {
        ingestSourceId: 3,
        sourceUrl: 'https://example.com',
        sourceType: 'html',
      },
    );

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.created).toBe(0);
    expect(result.restored).toBe(0);
    // touchImportSeen query includes last_seen_at
    expect(mockQuery.mock.calls[2][0]).toMatch(/last_seen_at\s*=\s*NOW()/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('restores soft-deleted cup on update and increments restored', async () => {
    const model = new CupsModel();
    const existing = {
      id: 11,
      name: 'Cup B',
      organizer: 'Org',
      location: 'Place',
      start_date: null,
      end_date: null,
      categories: null,
      team_count: null,
      match_format: null,
      description: null,
      registration_url: null,
      source_url: 'https://example.com',
      source_type: 'html',
      ingest_source_id: 3,
      ingest_run_id: null,
      external_id: 'cup-2',
      deleted_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce([{ id: 11 }]).mockResolvedValueOnce([existing]);

    model.update = jest.fn().mockResolvedValue({ id: '11' });

    const result = await model.createManyFromImport(
      {},
      [
        {
          name: 'Cup B',
          organizer: 'Org',
          location: 'Place',
          external_id: 'cup-2',
          description: 'changed',
        },
      ],
      { ingestSourceId: 3, sourceUrl: 'https://example.com', sourceType: 'html' },
    );

    expect(result.updated).toBe(1);
    expect(result.restored).toBe(1);
    expect(model.update).toHaveBeenCalled();
  });

  test('location-only skip on soft-deleted cup restores via touchImportSeen', async () => {
    const model = new CupsModel();
    const existing = {
      id: 12,
      name: 'Cup C',
      organizer: 'Org',
      location: 'Manual',
      start_date: null,
      end_date: null,
      categories: null,
      team_count: null,
      match_format: null,
      description: null,
      registration_url: null,
      source_url: 'https://example.com',
      source_type: 'html',
      ingest_source_id: 3,
      ingest_run_id: null,
      external_id: 'cup-3',
      deleted_at: new Date().toISOString(),
    };

    mockQuery
      .mockResolvedValueOnce([{ id: 12 }])
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([{ id: 12 }]);

    const result = await model.createManyFromImport(
      {},
      [
        {
          name: 'Cup C',
          organizer: 'Org',
          location: 'From source',
          external_id: 'cup-3',
        },
      ],
      { ingestSourceId: 3, sourceUrl: 'https://example.com', sourceType: 'html' },
    );

    expect(result.skipped).toBe(1);
    expect(result.restored).toBe(1);
  });
});
