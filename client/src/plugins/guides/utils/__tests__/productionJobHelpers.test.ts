import type { ProductionJob, ProductionJobItem } from '../../types/guides';
import {
  canAdvancePhase,
  countPendingReviewItems,
  getProposedItemText,
  hasActiveProductionJob,
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
    scopeStopId: null,
    scopeVariantId: null,
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
    stopId: 'stop-1',
    variantId: 'var-1',
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
});
