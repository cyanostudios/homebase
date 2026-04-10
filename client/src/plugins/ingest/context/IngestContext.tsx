import React, { createContext } from 'react';

import type { IngestRun, IngestSource, PanelMode, ValidationError } from '../types/ingest';

export interface IngestContextType {
  isIngestPanelOpen: boolean;
  currentIngest: IngestSource | null;
  /** Guide naming alias for `currentIngest`. */
  currentIngestSource: IngestSource | null;
  panelMode: PanelMode;
  validationErrors: ValidationError[];
  ingest: IngestSource[];
  /** Guide naming alias for `ingest`. */
  ingestSources: IngestSource[];
  ingestRuns: IngestRun[];
  runsLoading: boolean;
  importRunning: boolean;
  isSaving: boolean;
  openIngestPanel: (item: IngestSource | null) => void;
  openIngestForEdit: (item: IngestSource) => void;
  openIngestForView: (item: IngestSource) => void;
  openIngestSourceForEdit: (item: IngestSource) => void;
  openIngestSourceForView: (item: IngestSource) => void;
  closeIngestPanel: () => void;
  saveIngest: (data: Record<string, unknown>) => Promise<boolean>;
  saveIngestSource: (data: Record<string, unknown>) => Promise<boolean>;
  deleteIngest: (id: string) => Promise<void>;
  deleteIngestSource: (id: string) => Promise<void>;
  deleteIngestSources: (ids: string[]) => Promise<void>;
  loadIngestRuns: (sourceId: string) => Promise<void>;
  /** Reload all sources (same as after create/update/delete). */
  loadIngestSources: () => Promise<IngestSource[]>;
  runIngestImport: (sourceId: string) => Promise<void>;
  runIngestSource: (sourceId: string) => Promise<void>;
  clearValidationErrors: () => void;
  selectedIngestIds: string[];
  toggleIngestSelected: (id: string) => void;
  selectAllIngest: (ids: string[]) => void;
  mergeIntoIngestSelection: (ids: string[]) => void;
  clearIngestSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  getDeleteMessage: (item: IngestSource | null) => string;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

export const IngestContext = createContext<IngestContextType | undefined>(undefined);

const EMPTY_INGEST_CONTEXT: IngestContextType = {
  isIngestPanelOpen: false,
  currentIngest: null,
  currentIngestSource: null,
  panelMode: 'create',
  validationErrors: [],
  ingest: [],
  ingestSources: [],
  ingestRuns: [],
  runsLoading: false,
  importRunning: false,
  isSaving: false,
  openIngestPanel: () => {},
  openIngestForEdit: () => {},
  openIngestForView: () => {},
  openIngestSourceForEdit: () => {},
  openIngestSourceForView: () => {},
  closeIngestPanel: () => {},
  saveIngest: async () => false,
  saveIngestSource: async () => false,
  deleteIngest: async () => {},
  deleteIngestSource: async () => {},
  deleteIngestSources: async () => {},
  loadIngestRuns: async () => {},
  loadIngestSources: async () => [],
  runIngestImport: async () => {},
  runIngestSource: async () => {},
  clearValidationErrors: () => {},
  selectedIngestIds: [],
  toggleIngestSelected: () => {},
  selectAllIngest: () => {},
  mergeIntoIngestSelection: () => {},
  clearIngestSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getDeleteMessage: () => '',
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function IngestNullProvider({ children }: { children: React.ReactNode }) {
  return <IngestContext.Provider value={EMPTY_INGEST_CONTEXT}>{children}</IngestContext.Provider>;
}
