// plugins/guides/__tests__/place-estimated-cost.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const { Database } = require('@homebase/core');
const { ProductionJobModel } = require('../production/ProductionJobModel');
const ProductionOrchestrationService = require('../production/ProductionOrchestrationService');

describe('sumPlaceEstimatedCost + list/get job contract', () => {
  const userId = 7;
  const placeId = '20';
  const req = { tenantPool: {}, session: { currentTenantUserId: userId } };

  beforeEach(() => {
    Database.get.mockReturnValue({
      getUserId: () => userId,
      query: jest.fn(),
    });
  });

  test('sumPlaceEstimatedCost returns null when no currency/cost rows', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([{ total_cost: 0, currency: null, all_estimated: null }]);

    await expect(model.sumPlaceEstimatedCost(req, placeId)).resolves.toBeNull();

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('guide_production_job_items');
    expect(sql).toContain('j.user_id = $2');
    expect(sql).toContain("i.status = 'completed'");
    expect(sql).toContain("provider_result->'cost'->>'totalCost'");
    expect(params).toEqual([placeId, userId]);
  });

  test('sumPlaceEstimatedCost sums completed item costs across steps', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([
      { total_cost: '0.012345678', currency: 'USD', all_estimated: true },
    ]);

    await expect(model.sumPlaceEstimatedCost(req, placeId)).resolves.toEqual({
      currency: 'USD',
      totalCost: 0.01234568,
      estimated: true,
    });
  });

  test('sumPlaceEstimatedCost treats all_estimated false as not estimated', async () => {
    const model = new ProductionJobModel();
    const db = Database.get(req);
    db.query.mockResolvedValueOnce([{ total_cost: 1.5, currency: 'EUR', all_estimated: false }]);

    await expect(model.sumPlaceEstimatedCost(req, placeId)).resolves.toEqual({
      currency: 'EUR',
      totalCost: 1.5,
      estimated: false,
    });
  });

  test('listJobs returns { jobs, placeTotalEstimatedCost, placeTotalEstimatedAudioCost }', async () => {
    const service = new ProductionOrchestrationService({});
    const jobs = [{ id: '49', placeId, status: 'completed' }];
    const placeTotalEstimatedCost = {
      currency: 'USD',
      totalCost: 0.0027,
      estimated: true,
    };
    const placeTotalEstimatedAudioCost = {
      currency: 'USD',
      totalCost: 0.01,
      estimated: true,
    };
    jest.spyOn(service.jobModel, 'listJobs').mockResolvedValue(jobs);
    jest
      .spyOn(service.jobModel, 'sumPlaceEstimatedCost')
      .mockResolvedValue(placeTotalEstimatedCost);
    service.guidesModel.sumPlaceEstimatedAudioCost = jest
      .fn()
      .mockResolvedValue(placeTotalEstimatedAudioCost);

    await expect(service.listJobs(req, placeId)).resolves.toEqual({
      jobs,
      placeTotalEstimatedCost,
      placeTotalEstimatedAudioCost,
    });
    expect(service.jobModel.sumPlaceEstimatedCost).toHaveBeenCalledWith(req, placeId);
    expect(service.guidesModel.sumPlaceEstimatedAudioCost).toHaveBeenCalledWith(req, placeId);
  });

  test('getJob includes placeTotalEstimatedCost and placeTotalEstimatedAudioCost', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '49',
      placeId,
      status: 'completed',
      jobOptions: null,
    };
    const items = [
      {
        id: '79',
        status: 'completed',
        step: 'text_derivation',
        providerKey: 'openai',
        providerResult: {
          usage: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
            latencyMs: 100,
          },
          cost: { currency: 'USD', totalCost: 0.001, estimated: true },
        },
      },
    ];
    const placeTotalEstimatedCost = {
      currency: 'USD',
      totalCost: 0.003,
      estimated: true,
    };
    const placeTotalEstimatedAudioCost = {
      currency: 'USD',
      totalCost: 0.02,
      estimated: true,
    };
    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);
    jest
      .spyOn(service.jobModel, 'sumPlaceEstimatedCost')
      .mockResolvedValue(placeTotalEstimatedCost);
    service.guidesModel.sumPlaceEstimatedAudioCost = jest
      .fn()
      .mockResolvedValue(placeTotalEstimatedAudioCost);

    const result = await service.getJob(req, placeId, '49');

    expect(result.job).toEqual(job);
    expect(result.items).toEqual(items);
    expect(result.placeTotalEstimatedCost).toEqual(placeTotalEstimatedCost);
    expect(result.placeTotalEstimatedAudioCost).toEqual(placeTotalEstimatedAudioCost);
    expect(result.usageSummary).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o-mini',
      totalTokens: 30,
      estimatedCost: { currency: 'USD', totalCost: 0.001, estimated: true },
    });
  });
});
