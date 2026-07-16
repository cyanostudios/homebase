export type GuideLifecycleStatus = 'draft' | 'active' | 'archived';
export type MasterGuideEditorialStatus = 'draft' | 'in-progress' | 'complete';
export type GuideStopEditorialStatus = MasterGuideEditorialStatus;

export interface GuideValidationError {
  field: string;
  message: string;
}

export interface Guide {
  id: string;
  displayName: string;
  shortIntro: string | null;
  geographicReference: string | null;
  lifecycleStatus: GuideLifecycleStatus;
  masterGuideId: string | null;
  sourceLanguage: string;
  masterGuideEditorialStatus: MasterGuideEditorialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuidePayload {
  displayName: string;
  shortIntro?: string | null;
  geographicReference?: string | null;
  lifecycleStatus?: GuideLifecycleStatus;
  sourceLanguage?: string;
  masterGuideEditorialStatus?: MasterGuideEditorialStatus;
}

export interface GuideStop {
  id: string;
  masterGuideId: string;
  placeId: string;
  title: string;
  sequenceOrder: number;
  canonicalNarrative: string | null;
  editorialStatus: GuideStopEditorialStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuideStopPayload {
  title: string;
  canonicalNarrative?: string | null;
  editorialStatus?: GuideStopEditorialStatus;
}

export type VariantType = 'quick' | 'normal' | 'deep';
export type PublicationStatus = 'draft' | 'ready' | 'published';
export type StalenessStatus = 'fresh' | 'stale';

export interface GuideVariantPresentation {
  id: string;
  stopId: string;
  placeId: string;
  variantType: VariantType;
  language: string;
  presentationText: string | null;
  publicationStatus: PublicationStatus;
  stalenessStatus: StalenessStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuideVariantCreatePayload {
  variantType: VariantType;
  language: string;
  presentationText?: string | null;
  publicationStatus?: PublicationStatus;
}

export interface GuideVariantUpdatePayload {
  presentationText?: string | null;
  publicationStatus?: PublicationStatus;
}

export const VARIANT_TYPES: VariantType[] = ['quick', 'normal', 'deep'];

export const PUBLICATION_STATUSES: PublicationStatus[] = ['draft', 'ready', 'published'];

export const STALENESS_STATUSES: StalenessStatus[] = ['fresh', 'stale'];

export function isVariantType(value: string): value is VariantType {
  return VARIANT_TYPES.includes(value as VariantType);
}

export function isPublicationStatus(value: string): value is PublicationStatus {
  return PUBLICATION_STATUSES.includes(value as PublicationStatus);
}

export function isStalenessStatus(value: string): value is StalenessStatus {
  return STALENESS_STATUSES.includes(value as StalenessStatus);
}

export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'stale';

export interface GuideAudio {
  id: string;
  variantId: string;
  stopId: string;
  placeId: string;
  status: AudioStatus;
  providerKey: string;
  storageRef: string | null;
  durationMs: number | null;
  mimeType: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export const AUDIO_STATUSES: AudioStatus[] = ['pending', 'processing', 'ready', 'failed', 'stale'];

export function isAudioStatus(value: string): value is AudioStatus {
  return AUDIO_STATUSES.includes(value as AudioStatus);
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

export const MASTER_GUIDE_EDITORIAL_STATUSES: MasterGuideEditorialStatus[] = [
  'draft',
  'in-progress',
  'complete',
];

export const GUIDE_STOP_EDITORIAL_STATUSES: GuideStopEditorialStatus[] =
  MASTER_GUIDE_EDITORIAL_STATUSES;

export function isMasterGuideEditorialStatus(value: string): value is MasterGuideEditorialStatus {
  return MASTER_GUIDE_EDITORIAL_STATUSES.includes(value as MasterGuideEditorialStatus);
}

export function isGuideStopEditorialStatus(value: string): value is GuideStopEditorialStatus {
  return GUIDE_STOP_EDITORIAL_STATUSES.includes(value as GuideStopEditorialStatus);
}

export type ProductionJobType = 'full_guide' | 'stop' | 'variant';
export type ProductionJobStatus =
  | 'pending'
  | 'planning'
  | 'processing'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type ProductionItemStep = 'text_derivation' | 'translation' | 'audio';
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

export interface ProductionJobOptions {
  type?: ProductionJobType;
  stopId?: string | null;
  variantId?: string | null;
  phases?: ProductionItemStep[];
  languages?: string[];
  force?: boolean;
}

export interface ProductionJob {
  id: string;
  userId: string;
  placeId: string;
  type: ProductionJobType;
  status: ProductionJobStatus;
  scopeStopId: string | null;
  scopeVariantId: string | null;
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
    variantType?: string;
    language?: string;
    finishReason?: string | null;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  requestedAt?: string;
  latencyMs?: number;
}

export interface ProductionJobItem {
  id: string;
  jobId: string;
  userId: string | null;
  stopId: string;
  variantId: string | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface ProductionJobDetail {
  job: ProductionJob;
  items: ProductionJobItem[];
}

export interface StartProductionJobPayload {
  type: ProductionJobType;
  stopId?: string;
  variantId?: string;
  force?: boolean;
  phases?: ProductionItemStep[];
  checkpointMode?: ProductionCheckpointMode;
  languages?: string[];
}

export type ProductionStartScope =
  | { type: 'full_guide' }
  | { type: 'stop'; stopId: string; stopTitle?: string }
  | { type: 'variant'; stopId: string; variantId: string; variantLabel?: string };

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

export const PRODUCTION_ITEM_STEPS: ProductionItemStep[] = [
  'text_derivation',
  'translation',
  'audio',
];

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
