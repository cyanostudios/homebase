import type { Mention } from '@/core/types/mention';

export type { Mention };

export interface Note {
  id: string;
  title: string;
  content: string;
  mentions: Mention[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}
