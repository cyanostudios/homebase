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

jest.mock('../crawler', () => ({
  crawl: jest.fn(async () => ({
    pages: [],
    siteMeta: { robotsTxtFound: false, sitemapFound: false, homepageHeaders: {} },
  })),
  MAX_PAGES: 500,
  QUICK_MAX_PAGES: 50,
}));

jest.mock('../scoring', () => ({
  analyzePage: jest.fn((page) => page),
  analyzeSite: jest.fn(() => ({ score: 80, pages: [] })),
}));

jest.mock('../compare', () => ({
  compareSummaries: jest.fn(() => ({})),
}));

const { Database } = require('@homebase/core');
const { AppError } = require('../../../../server/core/errors/AppError');
const { crawl } = require('../crawler');
const { startRun, failStaleRuns, __testing } = require('../runAudit');

function flush() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe('site audit concurrency', () => {
  beforeEach(() => {
    __testing.resetForTests();
  });

  afterEach(() => {
    __testing.resetForTests();
  });

  test('enforces one run per user and two runs globally', () => {
    expect(__testing.tryAcquireSlot(1, 'a')).toBe(true);
    expect(__testing.tryAcquireSlot('1', 'b')).toBe(false);
    expect(__testing.tryAcquireSlot(2, 'c')).toBe(true);
    expect(__testing.tryAcquireSlot(3, 'd')).toBe(false);

    __testing.releaseSlot('1', 'a');
    expect(__testing.tryAcquireSlot(3, 'd')).toBe(true);
  });

  test('a release for an unknown job does not free a global slot', () => {
    expect(__testing.tryAcquireSlot(1, 'a')).toBe(true);
    __testing.releaseSlot(1, 'missing');
    expect(__testing.tryAcquireSlot(2, 'b')).toBe(true);
    expect(__testing.tryAcquireSlot(3, 'c')).toBe(false);
  });

  test('a second overlapping start for the same user is rejected', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    Database.get.mockImplementation(() => ({
      getUserId: () => 5,
      getPool: () => pool,
    }));

    let releaseGetById;
    const getByIdGate = new Promise((resolve) => {
      releaseGetById = resolve;
    });

    let creates = 0;
    const model = {
      getById: jest.fn(async () => {
        await getByIdGate;
        return { id: '1', name: 'S', url: 'https://example.com/', competitorUrl: null };
      }),
      createRun: jest.fn(async () => {
        creates += 1;
        return { id: String(creates) };
      }),
      markRunRunning: jest.fn(async () => {}),
      getRunById: jest.fn(async (_req, _siteId, runId) => ({
        id: String(runId),
        status: 'running',
      })),
      finishRun: jest.fn(async () => {}),
      markSiteAuditScore: jest.fn(async () => {}),
      attachComparison: jest.fn(async () => {}),
    };

    const first = startRun(model, {}, '1');
    const second = startRun(model, {}, '1');
    releaseGetById();

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(AppError);
    expect(rejected[0].reason.statusCode).toBe(429);
    expect(model.createRun).toHaveBeenCalledTimes(1);

    await flush();
  });

  test('startRun rejects with 429 when global concurrency is already full', async () => {
    expect(__testing.tryAcquireSlot(1, 'slot-a')).toBe(true);
    expect(__testing.tryAcquireSlot(2, 'slot-b')).toBe(true);

    const query = jest.fn().mockResolvedValue({ rows: [] });
    Database.get.mockImplementation(() => ({
      getUserId: () => 3,
      getPool: () => ({ query }),
    }));

    const model = {
      getById: jest.fn(async () => ({
        id: '9',
        name: 'Full',
        url: 'https://example.com/',
        competitorUrl: null,
      })),
      createRun: jest.fn(),
    };

    let caught;
    try {
      await startRun(model, {}, '9');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect(caught.statusCode).toBe(429);
    expect(model.createRun).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual([3, 30]);
  });

  test('passes the same audit mode into the site and competitor crawls', async () => {
    crawl.mockClear();
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    Database.get.mockImplementation(() => ({
      getUserId: () => 8,
      getPool: () => pool,
    }));

    let creates = 0;
    const model = {
      getById: jest.fn(async () => ({
        id: '4',
        name: 'Mode',
        url: 'https://example.com/',
        competitorUrl: 'https://competitor.example/',
      })),
      createRun: jest.fn(async () => {
        creates += 1;
        return { id: String(creates), status: 'queued' };
      }),
      markRunRunning: jest.fn(async () => {}),
      getRunById: jest.fn(async (_req, _siteId, runId) => ({
        id: String(runId),
        status: 'running',
      })),
      finishRunIfActive: jest.fn(async () => ({ id: 'done' })),
      finishRun: jest.fn(async () => {}),
      markSiteAuditScore: jest.fn(async () => {}),
      attachComparison: jest.fn(async () => {}),
    };

    await startRun(model, {}, '4', { mode: 'quick' });
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }

    expect(crawl).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ mode: 'quick' }),
    );
    expect(crawl).toHaveBeenCalledWith(
      'https://competitor.example/',
      expect.objectContaining({ mode: 'quick' }),
    );

    crawl.mockClear();
    await startRun(model, {}, '4');
    for (let i = 0; i < 8; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
    expect(crawl).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ mode: 'full' }),
    );
    expect(crawl).toHaveBeenCalledWith(
      'https://competitor.example/',
      expect.objectContaining({ mode: 'full' }),
    );
  });
});

describe('failStaleRuns', () => {
  test('updates only the caller user and uses a bound interval', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await failStaleRuns({ query }, 9);

    expect(result.failed).toBe(2);
    expect(query.mock.calls[0][0]).toMatch(/s\.user_id = \$1/);
    expect(query.mock.calls[0][0]).not.toMatch(/INTERVAL '\$\{/);
    expect(query.mock.calls[0][1]).toEqual([9, 30]);
  });

  test('does nothing when there is no user id', async () => {
    const query = jest.fn();
    const result = await failStaleRuns({ query }, null);
    expect(result).toEqual({ failed: 0 });
    expect(query).not.toHaveBeenCalled();
  });
});
