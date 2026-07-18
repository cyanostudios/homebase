// plugins/guides/__tests__/production-orchestration.test.js
jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  Database: { get: jest.fn() },
}));

const ProductionOrchestrationService = require('../production/ProductionOrchestrationService');

function mockReadyProvider(service) {
  jest.spyOn(service.aiProviderRouter, 'checkReadiness').mockResolvedValue({
    ready: true,
    providerKey: 'openai',
    model: 'gpt-4o-mini',
  });
}

describe('ProductionOrchestrationService', () => {
  test('startJob enqueues async job as pending with default phases', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv' }),
    };

    const service = new ProductionOrchestrationService(guidesModel);
    mockReadyProvider(service);
    const job = {
      id: '99',
      placeId: '1',
      type: 'full_guide',
      status: 'pending',
      scopeStopId: null,
      scopeVariantId: null,
      phases: ['text_derivation'],
      checkpointMode: 'after_text',
      jobOptions: {
        type: 'full_guide',
        phases: ['text_derivation'],
        force: false,
      },
    };

    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJob').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    const result = await service.startJob({}, '1', { type: 'full_guide' });

    expect(result.job.status).toBe('pending');
    expect(result.items).toHaveLength(0);
    expect(service.jobModel.createJob).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({
        phases: ['text_derivation'],
        checkpointMode: 'after_text',
      }),
    );
  });

  test('startJob accepts explicit phases and checkpointMode', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    mockReadyProvider(service);
    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJob').mockResolvedValue({ id: '1', status: 'pending' });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    await service.startJob({}, '1', {
      type: 'full_guide',
      phases: ['text_derivation'],
      checkpointMode: 'after_each',
    });

    expect(service.jobModel.createJob).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({
        phases: ['text_derivation'],
        checkpointMode: 'after_each',
      }),
    );
  });

  test('startJob rejects when active job exists', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    mockReadyProvider(service);
    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(true);

    await expect(service.startJob({}, '1', { type: 'full_guide' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('startJob rejects with 422 when provider not ready', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.aiProviderRouter, 'checkReadiness').mockResolvedValue({
      ready: false,
      failure: { code: 'provider_not_configured' },
    });

    await expect(service.startJob({}, '1', { type: 'full_guide' })).rejects.toMatchObject({
      statusCode: 422,
      code: 'provider_not_configured',
    });
  });

  test('runWorkerTick plans only current phase step and completes to awaiting_review', async () => {
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

    const service = new ProductionOrchestrationService(guidesModel, {
      sourcePackService: {
        buildPack: jest.fn().mockResolvedValue({
          fetchedAt: '2026-07-18T00:00:00.000Z',
          placeDisplayName: null,
          sources: [{ sourceKey: 'wikipedia', status: 'empty', excerpts: [] }],
          excerpts: [],
          combinedText: '',
        }),
      },
    });
    const job = {
      id: '99',
      placeId: '1',
      type: 'full_guide',
      status: 'planning',
      currentPhaseIndex: 0,
      checkpointMode: 'after_text',
      phases: ['text_derivation', 'translation'],
      jobOptions: { type: 'full_guide', phases: ['text_derivation', 'translation'], force: false },
    };
    const pendingItem = {
      id: '1',
      jobId: '99',
      stopId: '10',
      variantId: '20',
      step: 'text_derivation',
      phaseIndex: 0,
      status: 'processing',
      providerKey: 'openai',
    };

    jest.spyOn(service.jobModel, 'claimPendingJob').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'hasCompletedFingerprint').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJobItem').mockResolvedValue(pendingItem);
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest.spyOn(service.jobModel, 'mergeJobOptions').mockImplementation(async (_req, _id, patch) => {
      job.jobOptions = { ...job.jobOptions, ...patch };
      return job;
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);
    jest
      .spyOn(service.textProviderConfigResolver, 'getPreferredProviderKey')
      .mockResolvedValue('openai');
    jest
      .spyOn(service.textProviderConfigResolver, 'getProviderVersion')
      .mockResolvedValue('openai@test');
    jest.spyOn(service.textProviderConfigResolver, 'createProvider').mockResolvedValue({
      generate: jest.fn().mockResolvedValue({
        status: 'ready',
        presentationText: 'AI text',
        providerResult: { presentationText: 'AI text' },
      }),
    });
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValueOnce({ ...job, status: 'processing' })
      .mockResolvedValueOnce({ ...job, status: 'awaiting_review', reviewPhase: 'text_derivation' });
    jest
      .spyOn(service.jobModel, 'claimPendingItems')
      .mockResolvedValueOnce([pendingItem])
      .mockResolvedValueOnce([]);
    jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({
      ...pendingItem,
      status: 'completed',
      reviewStatus: 'pending_review',
      providerResult: { presentationText: 'AI text' },
    });
    jest.spyOn(service.jobModel, 'listJobsByStatus').mockImplementation((_req, status) => {
      if (status === 'planning') return Promise.resolve([]);
      if (status === 'processing') {
        return Promise.resolve([{ ...job, status: 'processing' }]);
      }
      return Promise.resolve([]);
    });
    jest.spyOn(service.jobModel, 'countInFlightItems').mockResolvedValue(0);
    jest.spyOn(service.jobModel, 'summarizeJobItems').mockResolvedValue({
      total: 1,
      failed: 0,
      skipped: 0,
      reviewable: 1,
    });

    const claimed = await service.runWorkerTick({});

    expect(claimed).toBe(1);
    expect(service.jobModel.createJobItem).toHaveBeenCalledWith(
      {},
      '99',
      expect.objectContaining({ step: 'text_derivation', phaseIndex: 0 }),
    );
    expect(service.jobModel.updateJobStatus).toHaveBeenCalledWith(
      {},
      '1',
      '99',
      'processing',
      expect.objectContaining({ blockedFrom: ['cancelled'] }),
    );
  });

  test('runWorkerTick does not overwrite cancelled job to processing', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '99',
      placeId: '1',
      status: 'planning',
      currentPhaseIndex: 0,
      phases: ['text_derivation'],
      jobOptions: {},
    };

    jest.spyOn(service.jobModel, 'claimPendingJob').mockResolvedValue(job);
    jest
      .spyOn(service.jobModel, 'getJobByIdInternal')
      .mockResolvedValue({ ...job, status: 'cancelled' });
    jest.spyOn(service.jobModel, 'claimPendingItems').mockResolvedValue([]);
    jest.spyOn(service.jobModel, 'listJobsByStatus').mockResolvedValue([]);
    const planSpy = jest.spyOn(service, '_planJob').mockResolvedValue(undefined);
    const statusSpy = jest.spyOn(service.jobModel, 'updateJobStatus');

    await service.runWorkerTick({});

    expect(planSpy).not.toHaveBeenCalled();
    expect(statusSpy).not.toHaveBeenCalledWith({}, '1', '99', 'processing', expect.anything());
  });

  test('approvePhase advances when all items have terminal review status', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn(),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
      phases: ['text_derivation', 'translation'],
    };
    const items = [
      {
        id: '1',
        phaseIndex: 0,
        status: 'completed',
        step: 'text_derivation',
        stopId: '10',
        variantId: '20',
        reviewStatus: 'approved',
        providerResult: { presentationText: 'Derived text' },
      },
      {
        id: '2',
        phaseIndex: 0,
        status: 'completed',
        step: 'text_derivation',
        stopId: '11',
        variantId: '21',
        reviewStatus: 'rejected',
        providerResult: { presentationText: 'Rejected text' },
      },
    ];

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);
    jest
      .spyOn(service.jobModel, 'requeueJobForNextPhase')
      .mockResolvedValue({ ...job, status: 'pending', currentPhaseIndex: 1 });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);

    const result = await service.approvePhase({}, '1', '99', { continue: true });

    expect(guidesModel.applyProductionPresentationText).not.toHaveBeenCalled();
    expect(service.jobModel.requeueJobForNextPhase).toHaveBeenCalledWith({}, '1', '99');
    expect(result.job.status).toBe('pending');
    expect(result.job.currentPhaseIndex).toBe(1);
  });

  test('approvePhase blocks when items still pending review', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
      phases: ['text_derivation', 'translation'],
    };
    const items = [
      {
        id: '1',
        phaseIndex: 0,
        status: 'completed',
        reviewStatus: 'pending_review',
        providerResult: { presentationText: 'Derived text' },
      },
    ];

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);

    await expect(service.approvePhase({}, '1', '99', { continue: true })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('approveItem applies text and marks item approved', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn().mockResolvedValue({ id: '20' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
    };
    const item = {
      id: '1',
      phaseIndex: 0,
      status: 'completed',
      step: 'text_derivation',
      stopId: '10',
      variantId: '20',
      reviewStatus: 'pending_review',
      providerResult: { presentationText: 'Derived text' },
    };

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'getJobItemById').mockResolvedValue(item);
    jest
      .spyOn(service.jobModel, 'updateJobItem')
      .mockResolvedValue({ ...item, reviewStatus: 'approved' });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest
      .spyOn(service.jobModel, 'listJobItems')
      .mockResolvedValue([{ ...item, reviewStatus: 'approved' }]);

    const result = await service.approveItem({}, '1', '99', '1');

    expect(guidesModel.applyProductionPresentationText).toHaveBeenCalledWith(
      {},
      '1',
      '10',
      '20',
      'Derived text',
    );
    expect(result.item.reviewStatus).toBe('approved');
  });

  test('rejectItem marks item rejected without applying domain', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn(),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
    };
    const item = {
      id: '1',
      phaseIndex: 0,
      status: 'completed',
      reviewStatus: 'pending_review',
      providerResult: { presentationText: 'Derived text' },
    };

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'getJobItemById').mockResolvedValue(item);
    jest
      .spyOn(service.jobModel, 'updateJobItem')
      .mockResolvedValue({ ...item, reviewStatus: 'rejected' });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest
      .spyOn(service.jobModel, 'listJobItems')
      .mockResolvedValue([{ ...item, reviewStatus: 'rejected' }]);

    const result = await service.rejectItem({}, '1', '99', '1', { reason: 'Bad tone' });

    expect(guidesModel.applyProductionPresentationText).not.toHaveBeenCalled();
    expect(result.item.reviewStatus).toBe('rejected');
  });

  test('regenerateItem supersedes old item and creates pending replacement', async () => {
    const guidesModel = {
      getStopById: jest.fn().mockResolvedValue({ id: '10', canonicalNarrative: 'Narrative' }),
      getVariantById: jest.fn().mockResolvedValue({
        id: '20',
        variantType: 'normal',
        language: 'sv',
        presentationText: null,
      }),
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv', ingestRunId: '7' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
    };
    const item = {
      id: '1',
      phaseIndex: 0,
      status: 'completed',
      step: 'text_derivation',
      stopId: '10',
      variantId: '20',
      reviewStatus: 'pending_review',
      providerKey: 'noop',
      providerVersion: '1',
      providerResult: { presentationText: 'Derived text' },
    };

    jest
      .spyOn(service.jobModel, 'getJobById')
      .mockResolvedValueOnce(job)
      .mockResolvedValueOnce({ ...job, status: 'processing' });
    jest.spyOn(service.jobModel, 'getJobItemById').mockResolvedValue(item);
    jest
      .spyOn(service.jobModel, 'updateJobItem')
      .mockResolvedValue({ ...item, reviewStatus: 'superseded' });
    jest.spyOn(service.jobModel, 'createJobItem').mockResolvedValue({
      id: '2',
      status: 'pending',
      phaseIndex: 0,
      step: 'text_derivation',
    });
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValue({ ...job, status: 'processing' });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([
      { ...item, reviewStatus: 'superseded' },
      { id: '2', status: 'pending' },
    ]);

    const result = await service.regenerateItem({}, '1', '99', '1');

    expect(service.jobModel.createJobItem).toHaveBeenCalledWith(
      {},
      '99',
      expect.objectContaining({ status: 'pending', phaseIndex: 0, step: 'text_derivation' }),
    );
    expect(result.job.status).toBe('processing');
    expect(result.item.status).toBe('pending');
  });

  test('bulkApproveItemsInPhase approves all pending_review items', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn().mockResolvedValue({ id: '20' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 0,
    };
    const items = [
      {
        id: '1',
        phaseIndex: 0,
        status: 'completed',
        step: 'text_derivation',
        stopId: '10',
        variantId: '20',
        reviewStatus: 'pending_review',
        providerResult: { presentationText: 'A' },
      },
      {
        id: '2',
        phaseIndex: 0,
        status: 'completed',
        step: 'text_derivation',
        stopId: '11',
        variantId: '21',
        reviewStatus: 'approved',
        providerResult: { presentationText: 'B' },
      },
    ];

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);
    jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);

    await service.bulkApproveItemsInPhase({}, '1', '99');

    expect(guidesModel.applyProductionPresentationText).toHaveBeenCalledTimes(1);
  });

  test('retryJob requeues failed job from current phase', async () => {
    const service = new ProductionOrchestrationService({});
    const job = {
      id: '99',
      placeId: '1',
      status: 'failed',
      currentPhaseIndex: 1,
      errorMessage: 'All production items failed',
    };

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'resetFailedItemsInPhase').mockResolvedValue(2);
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValue({ ...job, status: 'pending', errorMessage: null });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    const result = await service.retryJob({}, '1', '99');

    expect(service.jobModel.resetFailedItemsInPhase).toHaveBeenCalledWith({}, '99', 1);
    expect(service.jobModel.updateJobStatus).toHaveBeenCalledWith({}, '1', '99', 'pending', {
      clearErrorMessage: true,
    });
    expect(result.job.status).toBe('pending');
  });

  test('approvePhase completes job on last phase', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn(),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'awaiting_review',
      currentPhaseIndex: 1,
      phases: ['text_derivation', 'translation'],
    };
    const items = [
      {
        id: '2',
        phaseIndex: 1,
        status: 'completed',
        step: 'translation',
        stopId: '10',
        variantId: '20',
        reviewStatus: 'approved',
        providerResult: { translatedText: 'Translated' },
      },
    ];

    jest.spyOn(service.jobModel, 'getJobById').mockResolvedValue(job);
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue(items);
    jest
      .spyOn(service.jobModel, 'updateJobStatus')
      .mockResolvedValue({ ...job, status: 'completed' });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);

    const result = await service.approvePhase({}, '1', '99');

    expect(result.job.status).toBe('completed');
    expect(service.jobModel.updateJobStatus).toHaveBeenCalledWith({}, '1', '99', 'completed', {
      reviewPhase: null,
    });
  });

  test('approveJob delegates to approvePhase with deprecation warning', async () => {
    const service = new ProductionOrchestrationService({});
    jest
      .spyOn(service, 'approvePhase')
      .mockResolvedValue({ job: { status: 'completed' }, items: [] });

    await service.approveJob({}, '1', '99');

    expect(service.approvePhase).toHaveBeenCalledWith({}, '1', '99', { continue: true });
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
      checkpointMode: 'after_text',
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

  test('_evaluateProcessingJobs auto-advances when checkpointMode is auto', async () => {
    const guidesModel = {
      applyProductionPresentationText: jest.fn().mockResolvedValue({ id: '20' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    const job = {
      id: '99',
      placeId: '1',
      status: 'processing',
      phases: ['text_derivation', 'translation'],
      currentPhaseIndex: 0,
      checkpointMode: 'auto',
    };

    jest.spyOn(service.jobModel, 'listJobsByStatus').mockResolvedValue([job]);
    jest.spyOn(service.jobModel, 'countInFlightItems').mockResolvedValue(0);
    jest.spyOn(service.jobModel, 'summarizeJobItems').mockResolvedValue({
      total: 1,
      failed: 0,
      skipped: 0,
      reviewable: 1,
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([
      {
        id: '1',
        phaseIndex: 0,
        status: 'completed',
        step: 'text_derivation',
        stopId: '10',
        variantId: '20',
        reviewStatus: 'pending_review',
        providerResult: { presentationText: 'Text' },
      },
    ]);
    jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});
    jest
      .spyOn(service.jobModel, 'requeueJobForNextPhase')
      .mockResolvedValue({ ...job, status: 'pending', currentPhaseIndex: 1 });
    jest.spyOn(service.jobModel, 'appendEvent').mockResolvedValue(undefined);

    await service._evaluateProcessingJobs({});

    expect(service.jobModel.requeueJobForNextPhase).toHaveBeenCalledWith({}, '1', '99');
  });

  test('startJob stores languages in jobOptions', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', sourceLanguage: 'sv' }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    mockReadyProvider(service);
    jest.spyOn(service.jobModel, 'hasActiveJob').mockResolvedValue(false);
    jest.spyOn(service.jobModel, 'createJob').mockResolvedValue({ id: '1', status: 'pending' });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);

    await service.startJob({}, '1', { type: 'full_guide', languages: ['en', 'de'] });

    expect(service.jobModel.createJob).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({
        jobOptions: expect.objectContaining({ languages: ['en', 'de'] }),
      }),
    );
  });

  test('_filterTargetsByLanguages keeps only matching variants', () => {
    const service = new ProductionOrchestrationService({});
    const targets = [
      { stop: { id: '1' }, variant: { language: 'sv' } },
      { stop: { id: '2' }, variant: { language: 'en' } },
    ];
    const filtered = service._filterTargetsByLanguages(targets, ['en']);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].variant.language).toBe('en');
  });

  test('_shouldCheckpoint respects after_text and after_each', () => {
    const service = new ProductionOrchestrationService({});
    expect(service._shouldCheckpoint({ checkpointMode: 'after_text', currentPhaseIndex: 0 })).toBe(
      true,
    );
    expect(service._shouldCheckpoint({ checkpointMode: 'after_text', currentPhaseIndex: 1 })).toBe(
      false,
    );
    expect(service._shouldCheckpoint({ checkpointMode: 'after_each', currentPhaseIndex: 1 })).toBe(
      true,
    );
    expect(service._shouldCheckpoint({ checkpointMode: 'auto', currentPhaseIndex: 0 })).toBe(false);
  });

  test('_providerKeyForStep resolves preferred text provider', async () => {
    const service = new ProductionOrchestrationService({});
    jest
      .spyOn(service.textProviderConfigResolver, 'getPreferredProviderKey')
      .mockResolvedValue('openai');

    await expect(service._providerKeyForStep({}, 'text_derivation')).resolves.toBe('openai');
    await expect(service._providerKeyForStep({}, 'translation')).resolves.toBe('noop');
  });

  test('_processItem schedules retry for text_derivation rate limit', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', place: null }),
      getStopById: jest.fn().mockResolvedValue({
        id: '10',
        canonicalNarrative: 'Narrative',
      }),
      getVariantById: jest.fn().mockResolvedValue({
        id: '20',
        variantType: 'normal',
        language: 'sv',
      }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue({
      id: '99',
      placeId: '1',
      status: 'processing',
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);
    const updateSpy = jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});

    const mockProvider = {
      generate: jest.fn().mockResolvedValue({
        status: 'retry',
        retryAfterMs: 5000,
        errorMessage: 'Rate limited',
        failureCode: 'provider_rate_limited',
      }),
    };
    jest
      .spyOn(service.textProviderConfigResolver, 'createProvider')
      .mockResolvedValue(mockProvider);

    await service._processItem(
      {},
      {
        id: '1',
        jobId: '99',
        stopId: '10',
        variantId: '20',
        step: 'text_derivation',
        providerKey: 'openai',
      },
    );

    expect(updateSpy).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({
        status: 'pending',
        errorMessage: 'Rate limited',
        retryAfter: expect.any(String),
        failureCode: 'provider_rate_limited',
      }),
    );
  });

  test('_processItem stores full providerResult blob from adapter', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', place: null }),
      getStopById: jest.fn().mockResolvedValue({
        id: '10',
        canonicalNarrative: 'Narrative',
      }),
      getVariantById: jest.fn().mockResolvedValue({
        id: '20',
        variantType: 'normal',
        language: 'sv',
      }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue({
      id: '99',
      placeId: '1',
      status: 'processing',
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([]);
    const updateSpy = jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});

    const fullBlob = {
      presentationText: 'AI text',
      raw: { text: 'AI text', model: 'gpt-4o-mini' },
      usage: { totalTokens: 100 },
    };
    jest.spyOn(service.textProviderConfigResolver, 'createProvider').mockResolvedValue({
      generate: jest.fn().mockResolvedValue({
        status: 'ready',
        presentationText: 'AI text',
        providerResult: fullBlob,
      }),
    });

    await service._processItem(
      {},
      {
        id: '2',
        jobId: '99',
        stopId: '10',
        variantId: '20',
        step: 'text_derivation',
        providerKey: 'openai',
      },
    );

    expect(updateSpy).toHaveBeenCalledWith(
      {},
      '2',
      expect.objectContaining({
        status: 'completed',
        providerResult: fullBlob,
        reviewStatus: 'pending_review',
      }),
    );
  });

  test('_processItem waits for deep sibling before summarizing normal', async () => {
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', place: null }),
      getStopById: jest.fn().mockResolvedValue({
        id: '10',
        canonicalNarrative: 'Narrative',
      }),
      getVariantById: jest
        .fn()
        .mockResolvedValueOnce({
          id: '20',
          variantType: 'normal',
          language: 'sv',
        })
        .mockResolvedValueOnce({
          id: '21',
          variantType: 'deep',
          language: 'sv',
        }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue({
      id: '99',
      placeId: '1',
      status: 'processing',
      jobOptions: {
        sourcePack: { combinedText: 'Pack text', sources: [], excerpts: [] },
      },
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([
      {
        id: '2',
        stopId: '10',
        variantId: '21',
        step: 'text_derivation',
        phaseIndex: 0,
        status: 'processing',
      },
    ]);
    const updateSpy = jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});
    const createProvider = jest
      .spyOn(service.textProviderConfigResolver, 'createProvider')
      .mockResolvedValue({ generate: jest.fn() });

    await service._processItem(
      {},
      {
        id: '1',
        jobId: '99',
        stopId: '10',
        variantId: '20',
        step: 'text_derivation',
        phaseIndex: 0,
        providerKey: 'openai',
      },
    );

    expect(createProvider).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(
      {},
      '1',
      expect.objectContaining({
        status: 'pending',
        errorMessage: 'Waiting for deep variant',
      }),
    );
  });

  test('_processItem passes deep text when summarizing normal', async () => {
    const generate = jest.fn().mockResolvedValue({
      status: 'ready',
      presentationText: 'Summary',
      providerResult: { presentationText: 'Summary' },
    });
    const guidesModel = {
      getById: jest.fn().mockResolvedValue({ id: '1', place: null }),
      getStopById: jest.fn().mockResolvedValue({
        id: '10',
        canonicalNarrative: '',
      }),
      getVariantById: jest
        .fn()
        .mockResolvedValueOnce({
          id: '20',
          variantType: 'normal',
          language: 'sv',
        })
        .mockResolvedValueOnce({
          id: '21',
          variantType: 'deep',
          language: 'sv',
        }),
    };
    const service = new ProductionOrchestrationService(guidesModel);
    jest.spyOn(service.jobModel, 'getJobByIdInternal').mockResolvedValue({
      id: '99',
      placeId: '1',
      status: 'processing',
      jobOptions: {
        sourcePack: { combinedText: 'Pack text', sources: [], excerpts: [] },
      },
    });
    jest.spyOn(service.jobModel, 'listJobItems').mockResolvedValue([
      {
        id: '2',
        stopId: '10',
        variantId: '21',
        step: 'text_derivation',
        phaseIndex: 0,
        status: 'completed',
        providerResult: { presentationText: 'Long deep text' },
      },
    ]);
    jest.spyOn(service.jobModel, 'updateJobItem').mockResolvedValue({});
    jest
      .spyOn(service.textProviderConfigResolver, 'createProvider')
      .mockResolvedValue({ generate });

    await service._processItem(
      {},
      {
        id: '1',
        jobId: '99',
        stopId: '10',
        variantId: '20',
        step: 'text_derivation',
        phaseIndex: 0,
        providerKey: 'openai',
      },
    );

    expect(generate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        sourceDeepText: 'Long deep text',
        sourcePackText: 'Pack text',
      }),
    );
  });
});
