import type { ProductionJob, ProductionJobItem } from '../../types/guides';
import {
  canAdvancePhase,
  countPendingReviewItems,
  formatProductionElapsed,
  getProductionElapsedStartIso,
  getProductionJobFailureSummary,
  getProposedItemText,
  getTextPipelineStage,
  hasActiveProductionJob,
  isProductionJobGenerating,
  isProductionJobStalled,
  parseProductionJobListResponse,
  resolveProductionJobTargetId,
  resolveSourceSummary,
  shouldPollProductionJob,
  shouldShowReviewQueue,
  upsertJobInList,
} from '../productionJobHelpers';

function makeJob(overrides: Partial<ProductionJob> = {}): ProductionJob {
  return {
    id: '1',
    userId: '1',
    placeId: '10',
    type: 'full_guide',
    status: 'awaiting_review',
    phases: ['text_derivation', 'translation'],
    currentPhaseIndex: 0,
    checkpointMode: 'after_text',
    priority: 50,
    queuedAt: null,
    workerClaimedAt: null,
    reviewPhase: 'text_derivation',
    jobOptions: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<ProductionJobItem> = {}): ProductionJobItem {
  return {
    id: 'item-1',
    jobId: '1',
    userId: '1',
    presentationId: 'pres-1',
    step: 'text_derivation',
    phaseIndex: 0,
    status: 'completed',
    fingerprint: null,
    providerKey: 'noop',
    providerVersion: '1',
    providerResult: { presentationText: 'Hello' },
    reviewStatus: 'pending_review',
    reviewedAt: null,
    retryCount: 0,
    retryAfter: null,
    externalId: null,
    workerClaimedAt: null,
    errorMessage: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('productionJobHelpers', () => {
  it('shouldPollProductionJob returns true for active statuses', () => {
    expect(shouldPollProductionJob('processing')).toBe(true);
    expect(shouldPollProductionJob('completed')).toBe(false);
  });

  it('shouldShowReviewQueue only for text awaiting_review', () => {
    expect(shouldShowReviewQueue(makeJob())).toBe(true);
    expect(
      shouldShowReviewQueue(makeJob({ reviewPhase: 'translation', status: 'awaiting_review' })),
    ).toBe(false);
    expect(shouldShowReviewQueue(makeJob({ status: 'processing' }))).toBe(false);
  });

  it('countPendingReviewItems counts completed items without terminal review', () => {
    const job = makeJob();
    const items = [
      makeItem({ id: 'a', reviewStatus: 'pending_review' }),
      makeItem({ id: 'b', reviewStatus: 'approved' }),
      makeItem({ id: 'c', reviewStatus: 'rejected' }),
    ];
    expect(countPendingReviewItems(job, items)).toBe(1);
  });

  it('canAdvancePhase requires all reviews resolved and no in-flight items', () => {
    const job = makeJob();
    const pending = [makeItem({ reviewStatus: 'pending_review' })];
    const ready = [makeItem({ reviewStatus: 'approved' }), makeItem({ reviewStatus: 'rejected' })];
    expect(canAdvancePhase(job, pending)).toBe(false);
    expect(canAdvancePhase(job, ready)).toBe(true);
  });

  it('getProposedItemText reads presentation or translated text', () => {
    expect(getProposedItemText(makeItem())).toBe('Hello');
    expect(
      getProposedItemText(
        makeItem({
          step: 'translation',
          providerResult: { translatedText: 'Hej' },
        }),
      ),
    ).toBe('Hej');
  });

  it('upsertJobInList clears hasActiveProductionJob when poll reaches completed', () => {
    const stale = [makeJob({ id: '1', status: 'processing' })];
    expect(hasActiveProductionJob(stale)).toBe(true);

    const synced = upsertJobInList(stale, makeJob({ id: '1', status: 'completed' }));
    expect(hasActiveProductionJob(synced)).toBe(false);
    expect(synced[0].status).toBe('completed');
  });

  it('upsertJobInList appends unknown jobs', () => {
    const list = upsertJobInList([], makeJob({ id: '9', status: 'pending' }));
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('9');
  });

  it('getTextPipelineStage maps research → generate → review', () => {
    expect(getTextPipelineStage(makeJob({ status: 'planning' }), [])).toBe('research');
    expect(
      getTextPipelineStage(
        makeJob({
          status: 'processing',
          jobOptions: { sourcePack: { sources: [{ sourceKey: 'wikipedia', status: 'ok' }] } },
        }),
        [makeItem({ status: 'processing' })],
      ),
    ).toBe('generate');
    expect(
      getTextPipelineStage(
        makeJob({
          status: 'processing',
          jobOptions: { sourcePack: { sources: [{ sourceKey: 'wikipedia', status: 'ok' }] } },
        }),
        [],
      ),
    ).toBe('generate');
    expect(getTextPipelineStage(makeJob({ status: 'awaiting_review' }), [])).toBe('review');
    expect(getTextPipelineStage(makeJob({ status: 'processing' }), [])).toBe('research');
  });

  it('resolveSourceSummary falls back to job sourcePack', () => {
    const summary = resolveSourceSummary(
      null,
      makeJob({
        jobOptions: {
          sourcePack: {
            sources: [
              {
                sourceKey: 'unesco',
                status: 'empty',
                excerpts: [],
              },
            ],
          },
        },
      }),
    );
    expect(summary?.sources[0]).toEqual(
      expect.objectContaining({ sourceKey: 'unesco', status: 'empty', excerptCount: 0 }),
    );
  });

  it('isProductionJobStalled after 20s with no claim and no items', () => {
    const queuedAt = '2026-01-01T00:00:00.000Z';
    const job = makeJob({
      status: 'pending',
      queuedAt,
      createdAt: queuedAt,
      workerClaimedAt: null,
    });
    expect(isProductionJobStalled(job, [], Date.parse(queuedAt) + 5_000)).toBe(false);
    expect(isProductionJobStalled(job, [], Date.parse(queuedAt) + 21_000)).toBe(true);
    expect(
      isProductionJobStalled(
        makeJob({ status: 'pending', queuedAt, workerClaimedAt: queuedAt }),
        [],
        Date.parse(queuedAt) + 60_000,
      ),
    ).toBe(false);
  });

  it('getProductionJobFailureSummary prefers quota over generic codes', () => {
    const summary = getProductionJobFailureSummary(makeJob({ status: 'failed' }), [
      makeItem({
        status: 'failed',
        failureCode: 'content_input_invalid',
        errorMessage: 'Waiting cascade',
      }),
      makeItem({
        id: 'item-2',
        status: 'failed',
        failureCode: 'provider_quota_exhausted',
        errorMessage: 'You exceeded your current quota',
      }),
    ]);
    expect(summary.failureCode).toBe('provider_quota_exhausted');
    expect(summary.detail).toContain('quota');
  });

  it('parseProductionJobListResponse reads jobs + placeTotalEstimatedCost', () => {
    const jobs = [makeJob({ id: '49', status: 'completed' })];
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
    expect(
      parseProductionJobListResponse({
        jobs,
        placeTotalEstimatedCost,
        placeTotalEstimatedAudioCost,
      }),
    ).toEqual({ jobs, placeTotalEstimatedCost, placeTotalEstimatedAudioCost });
  });

  it('parseProductionJobListResponse tolerates legacy array and invalid jobs', () => {
    const jobs = [makeJob({ id: '1' })];
    expect(parseProductionJobListResponse(jobs)).toEqual({
      jobs,
      placeTotalEstimatedCost: null,
      placeTotalEstimatedAudioCost: null,
    });
    expect(parseProductionJobListResponse({ jobs: undefined as unknown as never })).toEqual({
      jobs: [],
      placeTotalEstimatedCost: null,
      placeTotalEstimatedAudioCost: null,
    });
    expect(parseProductionJobListResponse(null)).toEqual({
      jobs: [],
      placeTotalEstimatedCost: null,
      placeTotalEstimatedAudioCost: null,
    });
  });

  it('resolveProductionJobTargetId prefers selection, then active, then latest', () => {
    const completed = makeJob({ id: '40', status: 'completed' });
    const active = makeJob({ id: '41', status: 'awaiting_review' });
    const olderCompleted = makeJob({ id: '39', status: 'completed' });
    // List order is created_at DESC (latest first).
    const list = [completed, active, olderCompleted];

    expect(resolveProductionJobTargetId(list, '39')).toBe('39');
    expect(resolveProductionJobTargetId(list, null)).toBe('41');
    expect(resolveProductionJobTargetId([completed, olderCompleted], null)).toBe('40');
    expect(resolveProductionJobTargetId([], null)).toBeNull();
    expect(resolveProductionJobTargetId(list, 'missing')).toBe('41');
  });

  it('isProductionJobGenerating covers worker-side statuses only', () => {
    expect(isProductionJobGenerating('pending')).toBe(true);
    expect(isProductionJobGenerating('planning')).toBe(true);
    expect(isProductionJobGenerating('processing')).toBe(true);
    expect(isProductionJobGenerating('awaiting_review')).toBe(false);
    expect(isProductionJobGenerating('completed')).toBe(false);
    expect(isProductionJobGenerating('failed')).toBe(false);
  });

  it('getProductionElapsedStartIso prefers started → claimed → queued → created', () => {
    expect(
      getProductionElapsedStartIso(
        makeJob({
          startedAt: '2026-01-01T00:03:00Z',
          workerClaimedAt: '2026-01-01T00:02:00Z',
          queuedAt: '2026-01-01T00:01:00Z',
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ),
    ).toBe('2026-01-01T00:03:00Z');
    expect(
      getProductionElapsedStartIso(
        makeJob({
          startedAt: null,
          workerClaimedAt: '2026-01-01T00:02:00Z',
          queuedAt: '2026-01-01T00:01:00Z',
        }),
      ),
    ).toBe('2026-01-01T00:02:00Z');
    expect(
      getProductionElapsedStartIso(
        makeJob({
          startedAt: null,
          workerClaimedAt: null,
          queuedAt: '2026-01-01T00:01:00Z',
        }),
      ),
    ).toBe('2026-01-01T00:01:00Z');
    expect(
      getProductionElapsedStartIso(
        makeJob({
          startedAt: null,
          workerClaimedAt: null,
          queuedAt: null,
          createdAt: '2026-01-01T00:00:00Z',
        }),
      ),
    ).toBe('2026-01-01T00:00:00Z');
  });

  it('formatProductionElapsed formats m:ss and h:mm:ss', () => {
    expect(formatProductionElapsed(0)).toBe('0:00');
    expect(formatProductionElapsed(1000)).toBe('0:01');
    expect(formatProductionElapsed(65_000)).toBe('1:05');
    expect(formatProductionElapsed(3_661_000)).toBe('1:01:01');
    expect(formatProductionElapsed(-5)).toBe('0:00');
  });
});
