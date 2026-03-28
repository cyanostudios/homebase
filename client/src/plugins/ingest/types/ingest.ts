export interface ValidationError {
  field: string;
  message: string;
}

/** Panel modes for ingest detail sidebar (guide §10). */
export type PanelMode = 'create' | 'edit' | 'view';

/** Allowed source types — guide §11. */
export type IngestSourceType = 'html' | 'pdf' | 'json' | 'xml' | 'other';

export type IngestFetchMethod = 'generic_http' | 'browser_fetch';
export type IngestFetchStatus = 'never' | 'success' | 'failed';

export interface IngestSource {
  id: string;
  name: string;
  sourceUrl: string;
  sourceType: IngestSourceType;
  fetchMethod: IngestFetchMethod;
  isActive: boolean;
  notes: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: IngestFetchStatus;
  lastFetchError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** API body for create/update (guide §10). */
export interface IngestSourcePayload {
  name: string;
  sourceUrl: string;
  sourceType: IngestSourceType;
  fetchMethod?: IngestFetchMethod;
  isActive?: boolean;
  notes?: string | null;
}

export interface IngestRun {
  id: string;
  sourceId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  /** Which strategy ran (null for runs recorded before this column existed). */
  fetchMethod: IngestFetchMethod | null;
  httpStatus: number | null;
  contentType: string | null;
  contentLength: number | null;
  rawExcerpt: string | null;
  errorMessage: string | null;
  createdAt: string;
}
