import React, { createContext, useContext } from 'react';

import type { RequestPayload } from '../api/requestsApi';
import { DEFAULT_REQUEST_TYPES } from '../types/requests';
import type { Request, RequestValidationError } from '../types/requests';
import type { RequestTypeConfig } from '../utils/requestTypeConfig';

const DEFAULT_REQUEST_TYPE_CONFIGS: RequestTypeConfig[] = DEFAULT_REQUEST_TYPES.map((key) => ({
  key,
}));

export type RequestsContextType = {
  isRequestPanelOpen: boolean;
  currentRequest: Request | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: RequestValidationError[];
  requests: Request[];
  requestsContentView: 'list' | 'settings';
  requestTypes: RequestTypeConfig[];
  saveRequestTypes: (types: RequestTypeConfig[]) => Promise<void>;
  isSaving: boolean;
  refreshRequests: () => Promise<void>;
  unopenedCount: number;
  markRequestViewed: (id: string) => Promise<void>;

  openRequestPanel: (request: Request | null) => void;
  openRequestForEdit: (request: Request) => void;
  openRequestForView: (request: Request) => void;
  openRequestSettings: () => void;
  closeRequestSettingsView: () => void;
  closeRequestPanel: () => void;
  saveRequest: (data: RequestPayload, requestId?: string) => Promise<boolean>;
  createRequest: (data: RequestPayload) => Promise<Request>;
  deleteRequest: (id: string) => Promise<void>;
  deleteRequests: (ids: string[]) => Promise<void>;
  /** Route garments-linked request to target list; updates local state. */
  sendRequestToList: (id: string) => Promise<Request>;

  selectedRequestIds: string[];
  toggleRequestSelected: (id: string) => void;
  selectAllRequests: (ids: string[]) => void;
  mergeIntoRequestSelection: (ids: string[]) => void;
  clearRequestSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  clearValidationErrors: () => void;
  getPanelTitle: (mode: string, item: Request | null) => React.ReactNode;
  getDeleteMessage: (item: Request | null) => string;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
};

export const RequestsContext = createContext<RequestsContextType | undefined>(undefined);

export function useRequestsContext() {
  const context = useContext(RequestsContext);
  if (!context) {
    throw new Error('useRequestsContext must be used within RequestProvider');
  }
  return context;
}

const EMPTY_REQUESTS_CONTEXT: RequestsContextType = {
  isRequestPanelOpen: false,
  currentRequest: null,
  panelMode: 'create',
  validationErrors: [],
  requests: [],
  requestsContentView: 'list',
  requestTypes: DEFAULT_REQUEST_TYPE_CONFIGS,
  saveRequestTypes: async () => {},
  isSaving: false,
  refreshRequests: async () => {},
  unopenedCount: 0,
  markRequestViewed: async () => {},
  openRequestPanel: () => {},
  openRequestForEdit: () => {},
  openRequestForView: () => {},
  openRequestSettings: () => {},
  closeRequestSettingsView: () => {},
  closeRequestPanel: () => {},
  saveRequest: async () => false,
  createRequest: async () => ({}) as Request,
  deleteRequest: async () => {},
  deleteRequests: async () => {},
  sendRequestToList: async () => ({}) as Request,
  selectedRequestIds: [],
  toggleRequestSelected: () => {},
  selectAllRequests: () => {},
  mergeIntoRequestSelection: () => {},
  clearRequestSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  clearValidationErrors: () => {},
  getPanelTitle: () => null,
  getDeleteMessage: () => '',
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function RequestsNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <RequestsContext.Provider value={EMPTY_REQUESTS_CONTEXT}>{children}</RequestsContext.Provider>
  );
}
