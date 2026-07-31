export type GuideLifecycleStatus = 'draft' | 'active' | 'archived';
export type MasterGuideEditorialStatus = 'draft' | 'in-progress' | 'complete';

export interface GuideValidationError {
  field: string;
  message: string;
}

export interface Guide {
  id: string;
  displayName: string;
  shortIntro: string | null;
  geographicReference: string | null;
  place?: PlaceResolved | null;
  lifecycleStatus: GuideLifecycleStatus;
  masterGuideId: string | null;
  sourceLanguage: string;
  masterGuideEditorialStatus: MasterGuideEditorialStatus;
  /** ISO language codes with non-empty presentation text. */
  languages: string[];
  /** True when at least one language has audio status ready. */
  hasReadyAudio: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuidePayload {
  displayName: string;
  shortIntro?: string | null;
  geographicReference?: string | null;
  place?: PlaceResolved | null;
  lifecycleStatus?: GuideLifecycleStatus;
  sourceLanguage?: string;
  masterGuideEditorialStatus?: MasterGuideEditorialStatus;
}

export type PlaceProviderKey = 'nominatim' | 'google' | 'mapbox' | 'manual';

export interface PlaceResolved {
  provider: PlaceProviderKey | string;
  providerRef: string | null;
  displayName: string;
  formattedAddress: string | null;
  coordinates: { lat: number; lng: number } | null;
  countryCode: string | null;
  adminArea: string | null;
  locality: string | null;
  placeTypes: string[];
  bbox: [number, number, number, number] | null;
  resolvedAt: string;
}

export type GenerationFailureCode =
  | 'provider_not_configured'
  | 'provider_not_generation_capable'
  | 'provider_auth_failed'
  | 'provider_quota_exhausted'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_invalid_request'
  | 'content_input_invalid'
  | 'provider_unknown_error';

export const RETRYABLE_GENERATION_FAILURE_CODES: GenerationFailureCode[] = [
  'provider_rate_limited',
  'provider_unavailable',
];

export function isRetryableGenerationFailure(code: string | null | undefined): boolean {
  return RETRYABLE_GENERATION_FAILURE_CODES.includes(code as GenerationFailureCode);
}

export interface GenerationUsageSummary {
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: {
    currency: string;
    totalCost: number;
    estimated: boolean;
  } | null;
  sources?: GenerationSourceSummary | null;
}

export interface GenerationSourceSummaryEntry {
  sourceKey: string;
  status: 'ok' | 'empty' | 'failed' | string;
  excerptCount: number;
  errorMessage?: string | null;
  attribution?: string | null;
}

export interface GenerationSourceSummary {
  fetchedAt: string | null;
  placeDisplayName: string | null;
  sources: GenerationSourceSummaryEntry[];
  excerptCount: number;
}

export interface ContentSourceSetting {
  key: string;
  label: string;
  attribution: string | null;
  enabledByDefault: boolean;
  enabled: boolean;
}

export interface ProductionWorkerSettings {
  workerEnabled: boolean;
  pollIntervalMs: number;
  allowedPollIntervalMs: number[];
}

export type PublicationStatus = 'draft' | 'ready' | 'published';
export type StalenessStatus = 'fresh' | 'stale';
export type PresentationApprovalStatus = 'draft' | 'pending_review' | 'approved';

export interface GuidePresentation {
  id: string;
  masterGuideId: string;
  placeId: string;
  language: string;
  presentationText: string | null;
  publicationStatus: PublicationStatus;
  stalenessStatus: StalenessStatus;
  approvalStatus: PresentationApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuidePresentationUpdatePayload {
  presentationText?: string | null;
  publicationStatus?: PublicationStatus;
}

export const PUBLICATION_STATUSES: PublicationStatus[] = ['draft', 'ready', 'published'];

export const STALENESS_STATUSES: StalenessStatus[] = ['fresh', 'stale'];

export const PRESENTATION_APPROVAL_STATUSES: PresentationApprovalStatus[] = [
  'draft',
  'pending_review',
  'approved',
];

export function isPublicationStatus(value: string): value is PublicationStatus {
  return PUBLICATION_STATUSES.includes(value as PublicationStatus);
}

export function isStalenessStatus(value: string): value is StalenessStatus {
  return STALENESS_STATUSES.includes(value as StalenessStatus);
}

export function isPresentationApprovalStatus(value: string): value is PresentationApprovalStatus {
  return PRESENTATION_APPROVAL_STATUSES.includes(value as PresentationApprovalStatus);
}

export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'stale';

export const AUDIO_STATUSES: AudioStatus[] = ['pending', 'processing', 'ready', 'failed', 'stale'];

export function isAudioStatus(value: string): value is AudioStatus {
  return AUDIO_STATUSES.includes(value as AudioStatus);
}

export interface GuideAudio {
  id: string;
  presentationId: string;
  placeId: string;
  language: string;
  status: AudioStatus;
  providerKey: string;
  storageRef: string | null;
  durationMs: number | null;
  mimeType: string | null;
  errorMessage: string | null;
  cost?: PlaceTotalEstimatedCost | null;
  createdAt: string;
  updatedAt: string;
}

export const GUIDE_LIFECYCLE_STATUSES: GuideLifecycleStatus[] = ['draft', 'active', 'archived'];

export const GUIDE_LIFECYCLE_COLORS: Record<GuideLifecycleStatus, string> = {
  draft:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  active:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  archived:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-secondary/50 text-secondary-foreground',
};

export const GUIDE_PUBLICATION_COLORS: Record<PublicationStatus, string> = {
  draft:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ready:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-50/90 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  published:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export const GUIDE_APPROVAL_COLORS: Record<PresentationApprovalStatus, string> = {
  draft:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  pending_review:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  approved:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export const GUIDE_STALENESS_COLORS: Record<StalenessStatus, string> = {
  fresh:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
  stale:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-orange-50/90 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
};

export const GUIDE_EDITORIAL_COLORS: Record<MasterGuideEditorialStatus, string> = {
  draft:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'in-progress':
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  complete:
    'border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export const GUIDE_LANGUAGE_SOURCE_BADGE_CLASS =
  'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase bg-plugin-subtle text-plugin';

export const GUIDE_LANGUAGE_BADGE_CLASS =
  'border border-border/70 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase bg-muted/40 text-muted-foreground';

export type ProductionStartMode = 'source' | 'translation';

export const MASTER_GUIDE_EDITORIAL_STATUSES: MasterGuideEditorialStatus[] = [
  'draft',
  'in-progress',
  'complete',
];

export function isMasterGuideEditorialStatus(value: string): value is MasterGuideEditorialStatus {
  return MASTER_GUIDE_EDITORIAL_STATUSES.includes(value as MasterGuideEditorialStatus);
}

export type ProductionJobType = 'full_guide';
export type ProductionJobStatus =
  | 'pending'
  | 'planning'
  | 'processing'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled';
export const SUGGESTED_GUIDE_LANGUAGES = [
  'en',
  'sv',
  'it',
  'de',
  'fr',
  'es',
  'pt',
  'nl',
  'da',
  'no',
  'fi',
  'pl',
];

export type ProductionItemStep = 'text_derivation' | 'translation';
export type ProductionItemStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'awaiting_callback'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';
export type ProductionReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'superseded';
export type ProductionCheckpointMode = 'after_text' | 'after_each' | 'auto';

export const GUIDE_PRODUCTION_JOB_STATUS_COLORS: Record<ProductionJobStatus, string> = {
  pending:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  planning:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  processing:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  awaiting_review:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-amber-50/90 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  completed:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  failed:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-red-50/90 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  cancelled:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-secondary/50 text-secondary-foreground',
};

export const GUIDE_REVIEW_STATUS_COLORS: Record<ProductionReviewStatus, string> = {
  pending_review:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  approved:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  rejected:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-secondary/50 text-secondary-foreground',
  superseded:
    'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export const GUIDE_ITEM_PROCESSING_BADGE_CLASS =
  'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold gap-1 bg-blue-50/90 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';

export const GUIDE_ITEM_FAILED_BADGE_CLASS =
  'border-0 rounded-md px-2 py-0.5 text-[10px] font-semibold bg-red-50/90 text-red-700 dark:bg-red-950/40 dark:text-red-300';

export interface ProductionJobOptions {
  type?: ProductionJobType;
  phases?: ProductionItemStep[];
  languages?: string[];
  force?: boolean;
  sourcePack?: {
    fetchedAt?: string;
    placeDisplayName?: string | null;
    sources?: Array<{
      sourceKey: string;
      status: string;
      excerptCount?: number;
      excerpts?: unknown[];
      errorMessage?: string | null;
      attribution?: string | null;
    }>;
    excerpts?: unknown[];
    combinedText?: string;
  } | null;
}

export interface ProductionJob {
  id: string;
  userId: string;
  placeId: string;
  type: ProductionJobType;
  status: ProductionJobStatus;
  phases: ProductionItemStep[];
  currentPhaseIndex: number;
  checkpointMode: ProductionCheckpointMode;
  priority: number;
  queuedAt: string | null;
  workerClaimedAt: string | null;
  reviewPhase: ProductionItemStep | null;
  jobOptions: ProductionJobOptions | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionJobItemProviderResult {
  presentationText?: string;
  translatedText?: string;
  raw?: {
    text: string;
    model?: string;
    promptVersion?: string;
    promptSetVersion?: string;
    language?: string;
    finishReason?: string | null;
  };
  usage?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
  };
  cost?: {
    currency: string;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    estimated: boolean;
    pricingSource?: string;
  };
  requestedAt?: string;
  latencyMs?: number;
}

export interface ProductionJobItem {
  id: string;
  jobId: string;
  userId: string | null;
  presentationId: string;
  step: ProductionItemStep;
  phaseIndex: number;
  status: ProductionItemStatus;
  fingerprint: string | null;
  providerKey: string;
  providerVersion: string;
  providerResult: ProductionJobItemProviderResult | null;
  reviewStatus: ProductionReviewStatus | null;
  reviewedAt: string | null;
  retryCount: number;
  retryAfter: string | null;
  externalId: string | null;
  workerClaimedAt: string | null;
  errorMessage: string | null;
  failureCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceTotalEstimatedCost {
  currency: string;
  totalCost: number;
  estimated: boolean;
}

export interface ProductionJobDetail {
  job: ProductionJob;
  items: ProductionJobItem[];
  usageSummary?: GenerationUsageSummary | null;
  /** Sum of estimated costs across all completed production items for the place (text/translation). */
  placeTotalEstimatedCost?: PlaceTotalEstimatedCost | null;
  /** Sum of cumulative estimated TTS costs on guide_audio for the place. */
  placeTotalEstimatedAudioCost?: PlaceTotalEstimatedCost | null;
}

export interface ProductionJobListResponse {
  jobs: ProductionJob[];
  placeTotalEstimatedCost?: PlaceTotalEstimatedCost | null;
  placeTotalEstimatedAudioCost?: PlaceTotalEstimatedCost | null;
}

export interface StartProductionJobPayload {
  type: ProductionJobType;
  force?: boolean;
  phases?: ProductionItemStep[];
  checkpointMode?: ProductionCheckpointMode;
  languages?: string[];
}

export type ProductionStartScope = { type: 'full_guide' };

export const PRODUCTION_JOB_STATUSES: ProductionJobStatus[] = [
  'pending',
  'planning',
  'processing',
  'awaiting_review',
  'completed',
  'failed',
  'cancelled',
];

export const PRODUCTION_ACTIVE_JOB_STATUSES: ProductionJobStatus[] = [
  'pending',
  'planning',
  'processing',
  'awaiting_review',
];

export const PRODUCTION_POLL_JOB_STATUSES: ProductionJobStatus[] = [
  'pending',
  'planning',
  'processing',
  'awaiting_review',
];

export const PRODUCTION_ITEM_STEPS: ProductionItemStep[] = ['text_derivation', 'translation'];

export const PRODUCTION_MVP_PHASES: ProductionItemStep[] = ['text_derivation', 'translation'];

export function isProductionJobStatus(value: string): value is ProductionJobStatus {
  return PRODUCTION_JOB_STATUSES.includes(value as ProductionJobStatus);
}

export function isProductionItemStep(value: string): value is ProductionItemStep {
  return PRODUCTION_ITEM_STEPS.includes(value as ProductionItemStep);
}

export function isProductionReviewStatus(value: string): value is ProductionReviewStatus {
  return ['pending_review', 'approved', 'rejected', 'superseded'].includes(value);
}
