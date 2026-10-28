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

const SiteAuditModel = require('../model');
const { AppError } = require('../../../server/core/errors/AppError');

describe('SiteAuditModel', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new SiteAuditModel();
  });

  test('transformRow maps the DB row to a camelCase DTO', () => {
    expect(
      model.transformRow({
        id: 3,
        name: 'My site',
        url: 'https://example.com/',
        competitor_url: null,
        last_score: 82,
        last_run_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: '3',
      name: 'My site',
      url: 'https://example.com/',
      competitorUrl: null,
      lastScore: 82,
      lastRunAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('transformRunRow maps the DB row to a camelCase DTO', () => {
    expect(
      model.transformRunRow({
        id: 10,
        site_audit_id: 3,
        target: 'competitor',
        status: 'done',
        score: 55,
        summary: { score: 55 },
        pages: [{ url: 'https://example.com/' }],
        error: null,
        started_at: 'a',
        finished_at: 'b',
      }),
    ).toEqual({
      id: '10',
      siteAuditId: '3',
      target: 'competitor',
      status: 'done',
      score: 55,
      summary: { score: 55 },
      pages: [{ url: 'https://example.com/' }],
      error: null,
      startedAt: 'a',
      finishedAt: 'b',
    });
  });

  describe('normalizeFields', () => {
    test('requires a non-empty, non-whitespace name', () => {
      expect(() => model.normalizeFields({ name: '   ', url: 'https://example.com/' })).toThrow(
        AppError,
      );
    });

    test('rejects a name over 255 characters', () => {
      expect(() =>
        model.normalizeFields({ name: 'a'.repeat(256), url: 'https://example.com/' }),
      ).toThrow(AppError);
    });

    test('requires url and rejects malformed or private URLs', () => {
      expect(() => model.normalizeFields({ name: 'Site' })).toThrow(AppError);
      expect(() => model.normalizeFields({ name: 'Site', url: 'not a url' })).toThrow(AppError);
      expect(() => model.normalizeFields({ name: 'Site', url: 'http://127.0.0.1/' })).toThrow(
        AppError,
      );
      expect(() => model.normalizeFields({ name: 'Site', url: 'http://localhost/' })).toThrow(
        AppError,
      );
    });

    test('accepts a valid http or https url', () => {
      expect(model.normalizeFields({ name: 'Site', url: 'https://example.com/' }).url).toBe(
        'https://example.com/',
      );
      expect(model.normalizeFields({ name: 'Site', url: 'http://example.com/' }).url).toBe(
        'http://example.com/',
      );
    });

    test('allows an empty competitorUrl but rejects a private one', () => {
      expect(
        model.normalizeFields({ name: 'Site', url: 'https://example.com/', competitorUrl: '' })
          .competitorUrl,
      ).toBeNull();

      expect(() =>
        model.normalizeFields({
          name: 'Site',
          url: 'https://example.com/',
          competitorUrl: 'http://localhost/',
        }),
      ).toThrow(AppError);
    });

    test('partial mode only validates fields that are present', () => {
      expect(model.normalizeFields({ name: 'Only name' }, { partial: true })).toEqual({
        name: 'Only name',
      });
    });
  });

  test('updateRunRaw only updates runs owned by the caller', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 4,
          site_audit_id: 3,
          target: 'site',
          status: 'running',
          score: null,
          summary: {},
          pages: [],
          error: null,
          started_at: 'a',
          finished_at: null,
        },
      ],
    });
    Database.get.mockReturnValue({
      getUserId: () => 7,
      getPool: () => ({ query }),
    });

    await model.markRunRunning({}, 4);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/user_id = \$3/);
    expect(sql).toMatch(/site_audits/);
    expect(params).toEqual(['running', 4, 7]);
  });

  test('getRunById marks the caller stale runs failed before reading the row', async () => {
    const { Database } = require('@homebase/core');
    const poolQuery = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 9 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            site_audit_id: 3,
            target: 'site',
            status: 'failed',
            score: null,
            summary: {},
            pages: [],
            error: 'stale',
            started_at: 'a',
            finished_at: 'b',
          },
        ],
      });
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn().mockResolvedValue([
        {
          id: 3,
          name: 'S',
          url: 'https://example.com/',
          competitor_url: null,
          last_score: null,
          last_run_at: null,
          created_at: 'a',
          updated_at: 'b',
        },
      ]),
      getPool: () => ({ query: poolQuery }),
    });

    const run = await model.getRunById({}, 3, 4);

    expect(run.status).toBe('failed');
    expect(poolQuery.mock.calls[0][0]).toMatch(/s\.user_id = \$1/);
    expect(poolQuery.mock.calls[0][1][0]).toBe(7);
    expect(poolQuery.mock.calls[0][1][1]).toBe(30);
  });
});
