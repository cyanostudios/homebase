// plugins/cups/services/__tests__/importFromIngest.test.js
jest.mock('../../../../server/core/ServiceManager');
jest.mock('../../../ingest/model');
jest.mock('../../../ingest/services/ingestService');
jest.mock('../parseCupSource');
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Context: {
    getUserId: jest.fn(),
  },
  Database: {},
}));

const ServiceManager = require('../../../../server/core/ServiceManager');
const IngestModel = require('../../../ingest/model');
const ingestService = require('../../../ingest/services/ingestService');
const { parseCupSource } = require('../parseCupSource');
const { Context } = require('@homebase/core');
const { AppError } = require('../../../../server/core/errors/AppError');

beforeEach(() => {
  jest.clearAllMocks();
  Context.getUserId.mockReturnValue(1);
});

describe('importFromIngest allowlist', () => {
  test('rejects sourceId not in non-empty allowedIngestSourceIds', async () => {
    ServiceManager.getMainPool = jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({
        rows: [{ settings: { allowedIngestSourceIds: ['3', '5'] } }],
      }),
    });

    const { importFromIngest } = require('../importFromIngest');
    const model = {};

    await expect(
      importFromIngest({ model, req: { session: { user: { id: 1 } } }, sourceId: '9' }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: AppError.CODES.FORBIDDEN,
    });
    expect(IngestModel).not.toHaveBeenCalled();
  });

  test('allows when allowlist is empty', async () => {
    ServiceManager.getMainPool = jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({
        rows: [{ settings: { allowedIngestSourceIds: [] } }],
      }),
    });

    IngestModel.mockImplementation(() => ({
      getSourceById: jest.fn().mockResolvedValue({
        id: 9,
        sourceUrl: 'https://example.com/cups',
        sourceType: 'html',
      }),
    }));
    ingestService.fetchSourceFromRecord = jest.fn().mockResolvedValue({
      ok: true,
      bodyText: '<html></html>',
      status: 200,
      finalUrl: 'https://example.com/cups',
      contentType: 'text/html',
    });
    parseCupSource.mockReturnValue([]);
    const model = {
      createManyFromImport: jest.fn().mockResolvedValue({
        created: 0,
        updated: 0,
        skipped: 0,
        restored: 0,
        errors: [],
      }),
    };

    const { importFromIngest } = require('../importFromIngest');
    const result = await importFromIngest({
      model,
      req: { session: { user: { id: 1 } } },
      sourceId: '9',
    });

    expect(result.fetched).toBe(true);
    expect(result.restored).toBe(0);
    expect(model.createManyFromImport).toHaveBeenCalled();
  });

  test('allows listed sourceId and returns restored from saveResult', async () => {
    ServiceManager.getMainPool = jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({
        rows: [{ settings: { allowedIngestSourceIds: ['9'] } }],
      }),
    });

    IngestModel.mockImplementation(() => ({
      getSourceById: jest.fn().mockResolvedValue({
        id: 9,
        sourceUrl: 'https://example.com/cups',
        sourceType: 'html',
      }),
    }));
    ingestService.fetchSourceFromRecord = jest.fn().mockResolvedValue({
      ok: true,
      bodyText: '<html>cups</html>',
      status: 200,
      finalUrl: 'https://example.com/cups',
      contentType: 'text/html',
    });
    parseCupSource.mockReturnValue([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    const model = {
      createManyFromImport: jest.fn().mockResolvedValue({
        created: 1,
        updated: 1,
        skipped: 1,
        restored: 2,
        errors: [],
      }),
      softDeleteMissingForSource: jest.fn().mockResolvedValue(0),
      hardDeleteExpiredForSource: jest.fn().mockResolvedValue(0),
    };

    const { importFromIngest } = require('../importFromIngest');
    const result = await importFromIngest({
      model,
      req: { session: { user: { id: 1 } } },
      sourceId: 9,
    });

    expect(result.restored).toBe(2);
    expect(result.diagnostics.sweepEligible).toBe(true);
    expect(model.softDeleteMissingForSource).toHaveBeenCalled();
  });

  test('skips sweep when parsed < MIN_ITEMS_FOR_SWEEP', async () => {
    ServiceManager.getMainPool = jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue({ rows: [{}] }),
    });
    IngestModel.mockImplementation(() => ({
      getSourceById: jest.fn().mockResolvedValue({
        id: 1,
        sourceUrl: 'https://example.com/cups',
        sourceType: 'html',
      }),
    }));
    ingestService.fetchSourceFromRecord = jest.fn().mockResolvedValue({
      ok: true,
      bodyText: 'x',
      status: 200,
      finalUrl: 'https://example.com/cups',
      contentType: 'text/html',
    });
    parseCupSource.mockReturnValue([{ name: 'Only one' }]);
    const model = {
      createManyFromImport: jest.fn().mockResolvedValue({
        created: 1,
        updated: 0,
        skipped: 0,
        restored: 0,
        errors: [],
      }),
      softDeleteMissingForSource: jest.fn(),
      hardDeleteExpiredForSource: jest.fn(),
    };

    const { importFromIngest } = require('../importFromIngest');
    const result = await importFromIngest({
      model,
      req: { session: { user: { id: 1 } } },
      sourceId: 1,
    });

    expect(result.diagnostics.sweepEligible).toBe(false);
    expect(model.softDeleteMissingForSource).not.toHaveBeenCalled();
  });
});
