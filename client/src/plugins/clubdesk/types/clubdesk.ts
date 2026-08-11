export type PublicationStatus = 'draft' | 'published';

export interface ClubdeskStep {
  id?: string;
  title: string;
  description: string | null;
  sequenceOrder: number;
  imageUrl: string | null;
}

export interface ClubdeskCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Clubdesk {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  featuredImageUrl: string | null;
  category: string | null;
  publicationStatus: PublicationStatus;
  /** When true, shown as a square card on public Home. */
  featured: boolean;
  sortOrder?: number;
  stepCount?: number;
  steps?: ClubdeskStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ClubdeskStepPayload {
  title: string;
  description: string | null;
  sequenceOrder: number;
  imageUrl: string | null;
}

export interface ClubdeskPayload {
  title: string;
  slug?: string;
  description: string | null;
  featuredImageUrl: string | null;
  category: string | null;
  publicationStatus: PublicationStatus;
  featured: boolean;
  steps: ClubdeskStepPayload[];
}

export interface ValidationError {
  field: string;
  message: string;
}
