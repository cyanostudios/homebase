import type {
  ProductionItemStep,
  ProductionJob,
  ProductionJobItem,
  ProductionJobStatus,
} from '../types/guides';
import { PRODUCTION_POLL_JOB_STATUSES } from '../types/guides';

export function shouldPollProductionJob(status: ProductionJobStatus): boolean {
  return PRODUCTION_POLL_JOB_STATUSES.includes(status);
}

export function isProductionJobActive(status: ProductionJobStatus): boolean {
  return shouldPollProductionJob(status);
}

export function getCurrentPhaseStep(job: ProductionJob): ProductionItemStep | null {
  const phases = job.phases ?? [];
  if (!phases.length) return null;
  return phases[job.currentPhaseIndex] ?? phases[0] ?? null;
}

export function getPhaseItems(job: ProductionJob, items: ProductionJobItem[]): ProductionJobItem[] {
  return items.filter((item) => item.phaseIndex === job.currentPhaseIndex);
}

export function summarizePhaseProgress(job: ProductionJob, items: ProductionJobItem[]) {
  const phaseItems = getPhaseItems(job, items);
  const total = phaseItems.length;
  const done = phaseItems.filter(
    (item) =>
      item.status === 'completed' ||
      item.status === 'skipped' ||
      item.status === 'failed' ||
      item.status === 'cancelled',
  ).length;
  return { done, total };
}

export function countPendingReviewItems(job: ProductionJob, items: ProductionJobItem[]): number {
  return getPhaseItems(job, items).filter(
    (item) =>
      item.status === 'completed' && (!item.reviewStatus || item.reviewStatus === 'pending_review'),
  ).length;
}

export function canAdvancePhase(job: ProductionJob, items: ProductionJobItem[]): boolean {
  if (job.status !== 'awaiting_review') return false;
  const phaseItems = getPhaseItems(job, items);
  if (
    phaseItems.some((item) =>
      ['pending', 'queued', 'processing', 'awaiting_callback'].includes(item.status),
    )
  ) {
    return false;
  }
  if (phaseItems.some((item) => item.status === 'failed')) return false;
  return countPendingReviewItems(job, items) === 0;
}

export function shouldShowReviewQueue(job: ProductionJob): boolean {
  return job.status === 'awaiting_review' && job.reviewPhase === 'text_derivation';
}

export function getProposedItemText(item: ProductionJobItem): string | null {
  if (!item.providerResult) return null;
  if (item.step === 'translation') {
    return item.providerResult.translatedText ?? null;
  }
  return item.providerResult.presentationText ?? null;
}

export function getNextPhaseLabelKey(job: ProductionJob): string | null {
  const phases = job.phases ?? [];
  if (job.currentPhaseIndex >= phases.length - 1) return 'guides.production.continueFinish';
  const next = phases[job.currentPhaseIndex + 1];
  if (next === 'translation') return 'guides.production.continueToTranslation';
  if (next === 'audio') return 'guides.production.continueToAudio';
  return 'guides.production.continueNextPhase';
}

export function findActiveJob<T extends { status: ProductionJobStatus }>(jobs: T[]): T | null {
  return jobs.find((job) => isProductionJobActive(job.status)) ?? null;
}

const TERMINAL_JOB_STATUSES: ProductionJobStatus[] = ['completed', 'failed', 'cancelled'];

export function isProductionJobTerminal(status: ProductionJobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function upsertJobInList<T extends { id: string }>(jobs: T[], updated: T): T[] {
  const index = jobs.findIndex((job) => job.id === updated.id);
  if (index === -1) {
    return [updated, ...jobs];
  }
  const next = [...jobs];
  next[index] = updated;
  return next;
}

export function hasActiveProductionJob<T extends { status: ProductionJobStatus }>(
  jobs: T[],
): boolean {
  return findActiveJob(jobs) !== null;
}
