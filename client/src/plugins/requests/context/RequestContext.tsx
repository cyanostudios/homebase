import React, { createContext, useContext } from 'react';

import type { RequestPayload } from '../api/requestsApi';
import { DEFAULT_REQUEST_TYPES } from '../types/requests';
import type { Request, RequestValidationError } from '../types/requests';

export type RequestsContextType = {
  isRequestPanelOpen: boolean;
  currentRequest: Request | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: RequestValidationError[];
  requests: Request[];
  requestsContentView: 'list' | 'settings';
  requestTypes: string[];
  saveRequestTypes: (types: string[]) => Promise<void>;
  isSaving: boolean;
  refreshRequests: () => Promise<void>;

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

  selectedRequestIds: string[];
  toggleRequestSelected: (id: string) => void;
  selectAllRequests: (ids: string[]) => void;
  mergeIntoRequestSelection: (ids: string[]) => void;
  clearRequestSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  clearValidationErrors: () => void;
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
  requestTypes: DEFAULT_REQUEST_TYPES,
  saveRequestTypes: async () => {},
  isSaving: false,
  refreshRequests: async () => {},
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
  selectedRequestIds: [],
  toggleRequestSelected: () => {},
  selectAllRequests: () => {},
  mergeIntoRequestSelection: () => {},
  clearRequestSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  clearValidationErrors: () => {},
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
