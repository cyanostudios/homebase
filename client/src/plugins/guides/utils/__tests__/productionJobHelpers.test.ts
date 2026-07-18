import type { ProductionJob, ProductionJobItem } from '../../types/guides';
import {
  canAdvancePhase,
  countPendingReviewItems,
  getProductionJobFailureSummary,
  getProposedItemText,
  getTextPipelineStage,
  hasActiveProductionJob,
  isProductionJobStalled,
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
});
