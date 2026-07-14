// plugins/guides/__tests__/production-orchestration.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const ProductionOrchestrationService = require('../production/ProductionOrchestrationService');

describe('ProductionOrchestrationService', () => {
  test('startJob enqueues async job as pending', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv' }),
    };

    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      type: 'full_guide',
      status: 'pending',
      scopeStopId: null,
      scopeVariantId: null,
      phases: ['text_derivation'],
      jobOptions: { type: 'full_guide', steps: ['text_derivation'], force: false },
    };

    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJob').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    const result = await service.startJob({}, '1', { type: 'full_guide' });

    expect(result.job.status).toBe('pending');
    expect(result.items).toHaveLength(0);
    expect(service.jobModel.createJob).toHaveBeenCalled();
  });

  test('startJob rejects when active job exists', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(true);

    await expect(service.startJob({}, '1', { type: 'full_guide' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('runWorkerTick plans items and completes job to awaiting_review', async () => {
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
      getStopById: jest.fn().mockResolvedValue({
        id: '10',
        canonicalNarrative: 'Narrative A',
      }),
      getVariantById: jest.fn().mockResolvedValue({
        id: '20',
        variantType: 'normal',
        language: 'sv',
        presentationText: null,
      }),
    };

    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      type: 'full_guide',
      status: 'planning',
      currentPhaseIndex: 0,
      phases: ['text_derivation'],
      jobOptions: { type: 'full_guide', steps: ['text_derivation'], force: false },
    };
    const pendingItem = {
      id: '1',
      jobId: '99',
      stopId: '10',
      variantId: '20',
      step: 'text_derivation',
      status: 'processing',
      providerKey: 'noop',
    };

    jest.spyOn(service.jobModel, 'claimPendingJob').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'hasCompletedFingerprint').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJobItem').mockResolvedValue(pendingItem);
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValueOnce({ ...job, status: 'processing' })
      .mockResolvedValueOnce({ ...job, status: 'awaiting_review', reviewPhase: 'text_derivation' });
    jest
      .spyOn(service.jobModel, 'claimPendingItems')
      .mockResolvedValueOnce([pendingItem])
      .mockResolvedValueOnce([]);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue({
      ...job,
      status: 'processing',
    });
    jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({
      ...pendingItem,
      status: 'completed',
      reviewStatus: 'pending_review',
      providerResult: { presentationText: '[normal/sv] Narrative A' },
    });
    jest
      .spyOn(service.jobModel, 'listJobsByStatus')
      .mockResolvedValue([{ ...job, status: 'processing' }]);
    jest.spyOn(service.jobModel, 'countInFlightItems').mockResolvedValue(0);
    jest.spyOn(service.jobModel, 'summarizeJobItems').mockResolvedValue({
      total: 1,
      failed: 0,
      skipped: 0,
      reviewable: 1,
    });

    const claimed = await service.runWorkerTick({});

    expect(claimed).toBe(1);
    expect(service.jobModel.createJobItem).toHaveBeenCalled();
    expect(service.jobModel.updateJobItem).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({ status: 'completed', reviewStatus: 'pending_review' }),
    );
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

  test('cancelJob cancels active items before marking job cancelled', async () => {
    const service = new ProductionOrchestrationService({});
    const job = { id: '99', status: 'processing' };
    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'cancelActiveItemsForJob').mockResolvedValue(2);
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValue({ ...job, status: 'cancelled' });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    await service.cancelJob({}, '1', '99');

    expect(service.jobModel.cancelActiveItemsForJob).toHaveBeenCalledWith({}, '99');
  });

  test('_processItem skips provider when job is cancelled', async () => {
    const guidesModel = {
      getStopById: jest.fn(),
      getVariantById: jest.fn(),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const item = {
      id: '1',
      jobId: '99',
      stopId: '10',
      variantId: '20',
      step: 'text_derivation',
      providerKey: 'noop',
    };

    jest
      .spyOn(service.jobModel, 'getJobByIdInternal')
      .mockResolvedValue({ id: '99', placeId: '1', status: 'cancelled' });
    jest
      .spyOn(service.jobModel, 'updateJobItem')
      .mockResolvedValue({ ...item, status: 'cancelled' });

    await service._processItem({}, item);

    expect(guidesModel.getStopById).not.toHaveBeenCalled();
    expect(service.jobModel.updateJobItem).toHaveBeenCalledWith({}, '1', { status: 'cancelled' });
  });

  test('_evaluateProcessingJobs marks job failed when all items failed', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '99',
      placeId: '1',
      status: 'processing',
      phases: ['text_derivation'],
      currentPhaseIndex: 0,
    };

    jest.spyOn(service.jobModel, 'listJobsByStatus').mockResolvedValue([job]);
    jest.spyOn(service.jobModel, 'countInFlightItems').mockResolvedValue(0);
    jest.spyOn(service.jobModel, 'summarizeJobItems').mockResolvedValue({
      total: 2,
      failed: 2,
      skipped: 0,
      reviewable: 0,
    });
    jest.spyOn(service.jobModel, 'updateJobStatus').mockResolvedValue({ ...job, status: 'failed' });

    await service._evaluateProcessingJobs({});

    expect(service.jobModel.updateJobStatus).toHaveBeenCalledWith(
      {},
      '1',
      '99',
      'failed',
      expect.objectContaining({ errorMessage: 'All production items failed' }),
    );
  });

  test('_evaluateProcessingJobs marks job failed when no targets planned', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '99',
      placeId: '1',
      status: 'processing',
      phases: ['text_derivation'],
      currentPhaseIndex: 0,
    };

    jest.spyOn(service.jobModel, 'listJobsByStatus').mockResolvedValue([job]);
    jest.spyOn(service.jobModel, 'countInFlightItems').mockResolvedValue(0);
    jest.spyOn(service.jobModel, 'summarizeJobItems').mockResolvedValue({
      total: 0,
      failed: 0,
      skipped: 0,
      reviewable: 0,
    });
    jest.spyOn(service.jobModel, 'updateJobStatus').mockResolvedValue({ ...job, status: 'failed' });

    await service._evaluateProcessingJobs({});

    expect(service.jobModel.updateJobStatus).toHaveBeenCalledWith(
      {},
      '1',
      '99',
      'failed',
      expect.objectContaining({ errorMessage: 'No production targets' }),
    );
  });
});
