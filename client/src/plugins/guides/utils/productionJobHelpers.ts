import type {
  GenerationSourceSummary,
  GenerationSourceSummaryEntry,
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

/** Visible editor pipeline for research-first text production. */
export type TextPipelineStage = 'research' | 'deep' | 'summarize' | 'review' | 'done' | 'failed';

const TEXT_PIPELINE_STAGES: TextPipelineStage[] = ['research', 'deep', 'summarize', 'review'];

export function getTextPipelineStages(): TextPipelineStage[] {
  return [...TEXT_PIPELINE_STAGES];
}

function isWaitingForDeep(item: ProductionJobItem): boolean {
  return (
    item.status === 'pending' &&
    typeof item.errorMessage === 'string' &&
    /waiting for deep/i.test(item.errorMessage)
  );
}

/**
 * Infer research → deep → summarize → review from job status + items.
 * Uses source pack presence and “waiting for deep” retries — no variantType on items required.
 */
export function getTextPipelineStage(
  job: ProductionJob,
  items: ProductionJobItem[],
): TextPipelineStage {
  if (job.status === 'failed') return 'failed';
  if (job.status === 'completed') return 'done';
  if (job.status === 'awaiting_review') return 'review';
  if (job.status === 'pending' || job.status === 'planning') return 'research';

  if (job.status === 'processing') {
    const pack = job.jobOptions?.sourcePack;
    if (!pack) return 'research';

    const phaseItems = getPhaseItems(job, items).filter((item) => item.step === 'text_derivation');
    if (phaseItems.length === 0) return 'deep';

    if (phaseItems.some(isWaitingForDeep)) return 'deep';

    const inFlight = phaseItems.filter((item) =>
      ['pending', 'queued', 'processing', 'awaiting_callback'].includes(item.status),
    );
    const completed = phaseItems.filter((item) => item.status === 'completed').length;

    if (inFlight.length === 0) return 'summarize';
    if (completed === 0) return 'deep';
    return 'summarize';
  }

  return 'research';
}

export function getSourcePackSummaryFromJob(
  job: ProductionJob | null,
): GenerationSourceSummary | null {
  const pack = job?.jobOptions?.sourcePack;
  if (!pack || !Array.isArray(pack.sources) || pack.sources.length === 0) return null;
  const sources: GenerationSourceSummaryEntry[] = pack.sources.map((s) => ({
    sourceKey: s.sourceKey,
    status: s.status,
    excerptCount: s.excerptCount ?? (Array.isArray(s.excerpts) ? s.excerpts.length : 0),
    errorMessage: s.errorMessage ?? null,
    attribution: s.attribution ?? null,
  }));
  return {
    fetchedAt: pack.fetchedAt ?? null,
    placeDisplayName: pack.placeDisplayName ?? null,
    sources,
    excerptCount: pack.excerpts?.length ?? sources.reduce((n, s) => n + s.excerptCount, 0),
  };
}

/** Prefer usageSummary.sources; fall back to job_options.sourcePack. */
export function resolveSourceSummary(
  usageSources: GenerationSourceSummary | null | undefined,
  job: ProductionJob | null,
): GenerationSourceSummary | null {
  if (usageSources?.sources?.length) return usageSources;
  return getSourcePackSummaryFromJob(job);
}

/** Job queued but never claimed / no items after a short wait — worker likely not running. */
const STALL_MS = 20_000;

export function isProductionJobStalled(
  job: ProductionJob,
  items: ProductionJobItem[],
  nowMs: number = Date.now(),
): boolean {
  if (job.status !== 'pending' && job.status !== 'planning') return false;
  if (items.length > 0) return false;
  if (job.workerClaimedAt) return false;
  const queued = Date.parse(job.queuedAt || job.createdAt || '');
  if (!Number.isFinite(queued)) return false;
  return nowMs - queued >= STALL_MS;
}

const FAILURE_CODE_PRIORITY = [
  'provider_quota_exhausted',
  'provider_auth_failed',
  'provider_rate_limited',
  'provider_unavailable',
  'provider_not_configured',
  'provider_invalid_request',
  'content_input_invalid',
  'provider_unknown_error',
] as const;

/**
 * User-facing failure summary from failed items (prefer stable failure codes).
 */
export function getProductionJobFailureSummary(
  job: ProductionJob,
  items: ProductionJobItem[],
): { failureCode: string | null; detail: string | null } {
  const failed = items.filter((item) => item.status === 'failed');
  if (!failed.length) {
    return {
      failureCode: null,
      detail:
        job.errorMessage && job.errorMessage !== 'All production items failed'
          ? job.errorMessage
          : null,
    };
  }

  for (const code of FAILURE_CODE_PRIORITY) {
    const match = failed.find((item) => item.failureCode === code);
    if (match) {
      return {
        failureCode: code,
        detail: match.errorMessage || null,
      };
    }
  }

  const first = failed[0];
  return {
    failureCode: first.failureCode || null,
    detail: first.errorMessage || job.errorMessage || null,
  };
}
