// plugins/guides/__tests__/production-orchestration.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const ProductionOrchestrationService = require('../production/ProductionOrchestrationService');

describe('ProductionOrchestrationService', () => {
  test('startJob runs text_derivation and ends awaiting_review', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv' }),
      getStops: jest
        .fn()
        .mockResolvedValue([{ id: '10', canonicalNarrative: 'Narrative A', title: 'Stop 1' }]),
      getVariants: jest.fn().mockResolvedValue([
        {
          id: '20',
          stopId: '10',
          variantType: 'normal',
          language: 'sv',
          presentationText: null,
        },
      ]),
    };

    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      type: 'full_guide',
      status: 'pending',
      scopeStopId: null,
      scopeVariantId: null,
    };
    const completedJob = { ...job, status: 'awaiting_review' };
    const item = {
      id: '1',
      jobId: '99',
      stopId: '10',
      variantId: '20',
      step: 'text_derivation',
      status: 'completed',
      providerResult: { presentationText: '[normal/sv] Narrative A' },
    };

    jest.spyOn(service.jobModel, 'createJob').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'updateJobStatus').mockResolvedValue(completedJob);
    jest.spyOn(service.jobModel, 'hasCompletedFingerprint').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJobItem').mockResolvedValue(item);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([item]);

    const result = await service.startJob({}, '1', { type: 'full_guide' });

    expect(result.job.status).toBe('awaiting_review');
    expect(result.items).toHaveLength(1);
    expect(service.jobModel.createJobItem).toHaveBeenCalled();
  });

  test('approveJob writes presentation text as pending_review', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn().mockResolvedValue({
        id: '20',
        approvalStatus: 'pending_review',
      }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = { id: '99', status: 'awaiting_review' };
    const items = [
      {
        id: '1',
        status: 'completed',
        step: 'text_derivation',
        stopId: '10',
        variantId: '20',
        providerResult: { presentationText: 'Derived text' },
      },
    ];

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValue({ ...job, status: 'completed' });

    const result = await service.approveJob({}, '1', '99');

    expect(guidesModel.applyProductionPresentationText).toHaveBeenCalledWith(
      {},
      '1',
      '10',
      '20',
      'Derived text',
    );
    expect(result.job.status).toBe('completed');
  });
});
