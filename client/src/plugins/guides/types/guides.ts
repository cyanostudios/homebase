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

export const GUIDE_LIFECYCLE_STATUSES: GuideLifecycleStatus[] = ['draft', 'active', 'archived'];

export const MASTER_GUIDE_EDITORIAL_STATUSES: MasterGuideEditorialStatus[] = [
  'draft',
  'in-progress',
  'complete',
];

export const GUIDE_STOP_EDITORIAL_STATUSES: GuideStopEditorialStatus[] =
  MASTER_GUIDE_EDITORIAL_STATUSES;

export function formatGuideLifecycleStatus(status: GuideLifecycleStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archived';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function formatMasterGuideEditorialStatus(status: MasterGuideEditorialStatus): string {
  switch (status) {
    case 'in-progress':
      return 'In progress';
    case 'complete':
      return 'Complete';
    case 'draft':
    default:
      return 'Draft';
  }
}

export function isMasterGuideEditorialStatus(value: string): value is MasterGuideEditorialStatus {
  return MASTER_GUIDE_EDITORIAL_STATUSES.includes(value as MasterGuideEditorialStatus);
}

export function isGuideStopEditorialStatus(value: string): value is GuideStopEditorialStatus {
  return GUIDE_STOP_EDITORIAL_STATUSES.includes(value as GuideStopEditorialStatus);
}
