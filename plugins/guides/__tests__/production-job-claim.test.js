// plugins/guides/__tests__/production-job-claim.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Database } = require('@homebase/core');
const { ProductionJobModel } = require('../production/ProductionJobModel');

describe('ProductionJobModel claim integration', () => {
  const userId = 42;
  const req = { tenantPool: {}, session: { currentTenantUserId: userId } };

  beforeEach(() => {
    Database.get.mockReturnValue({
      getUserId: () => userId,
      query: jest.fn(),
    });
  });

  test('claimPendingJob uses FOR UPDATE SKIP LOCKED and scopes by user_id', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([
      {
        id: 1,
        user_id: userId,
        place_id: 5,
        type: 'full_guide',
        status: 'planning',
        scope_stop_id: null,
        scope_variant_id: null,
        phases: ['text_derivation'],
        current_phase_index: 0,
        checkpoint_mode: 'after_text',
        priority: 50,
        queued_at: null,
        worker_claimed_at: null,
        review_phase: null,
        job_options: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const job = await model.claimPendingJob(req);

    expect(job).not.toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('user_id = $1');
    expect(params).toEqual([userId]);
  });

  test('claimPendingItems uses FOR UPDATE SKIP LOCKED and joins processing jobs', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([
      {
        id: 10,
        job_id: 1,
        user_id: userId,
        stop_id: 3,
        variant_id: 4,
        step: 'text_derivation',
        phase_index: 0,
        status: 'processing',
        fingerprint: 'abc',
        provider_key: 'noop',
        provider_version: '1',
        provider_result: null,
        review_status: null,
        reviewed_at: null,
        retry_count: 0,
        retry_after: null,
        external_id: null,
        worker_claimed_at: null,
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const items = await model.claimPendingItems(req, 5);

    expect(items).toHaveLength(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("j.status = 'processing'");
    expect(sql).toContain("i.status = 'pending'");
    expect(sql).toContain('i.user_id = $1');
    expect(params).toEqual([userId, 5]);
  });

  test('cancelActiveItemsForJob cancels pending and processing items for job', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const count = await model.cancelActiveItemsForJob(req, '99');

    expect(count).toBe(2);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("status = 'cancelled'");
    expect(sql).toContain("status IN ('pending', 'queued', 'processing', 'awaiting_callback')");
    expect(params).toEqual(['99', userId]);
  });
});
