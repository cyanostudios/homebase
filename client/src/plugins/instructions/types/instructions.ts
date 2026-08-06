export type PublicationStatus = 'draft' | 'published';

export interface InstructionStep {
  id?: string;
  title: string;
  description: string | null;
  sequenceOrder: number;
  imageUrl: string | null;
}

export interface InstructionCategory {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Instruction {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  featuredImageUrl: string | null;
  category: string | null;
  publicationStatus: PublicationStatus;
  sortOrder?: number;
  stepCount?: number;
  steps?: InstructionStep[];
  createdAt: string;
  updatedAt: string;
}

export interface InstructionStepPayload {
  title: string;
  description: string | null;
  sequenceOrder: number;
  imageUrl: string | null;
}

export interface InstructionPayload {
  title: string;
  slug?: string;
  description: string | null;
  featuredImageUrl: string | null;
  category: string | null;
  publicationStatus: PublicationStatus;
  steps: InstructionStepPayload[];
}

export interface ValidationError {
  field: string;
  message: string;
}
