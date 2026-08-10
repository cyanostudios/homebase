import React, { createContext } from 'react';

import type {
  MailCatalogEntry,
  MailContentView,
  MailLogEntry,
  MailPanelMode,
  MailProviderSettings,
  MailRoutingResponse,
  SaveMailProviderSettingsInput,
  SaveMailRoutingInput,
} from '../types/mail';

export interface MailContextType {
  isMailPanelOpen: boolean;
  panelMode: MailPanelMode;
  currentMail: MailProviderSettings | null;
  pendingProviderKey: string | null;
  mailHistory: MailLogEntry[];
  totalCount: number;
  providers: MailProviderSettings[];
  catalog: MailCatalogEntry[];
  routing: MailRoutingResponse | null;
  loading: boolean;
  routingLoading: boolean;
  mailContentView: MailContentView;
  openMailPanel: (provider?: MailProviderSettings | null) => void;
  openMailForEdit: (provider: MailProviderSettings) => void;
  openMailForView: (provider: MailProviderSettings) => void;
  closeMailPanel: () => void;
  openHistoryView: () => void;
  openRoutingView: () => void;
  closeRoutingView: () => void;
  /** Reset to main provider list (used by AppContent page-change cleanup). */
  closeMailSettingsView: () => void;
  setPendingProviderKey: (providerKey: string | null) => void;
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushMailEntry: (entry: MailLogEntry) => void;
  loadProviderSettings: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  loadRouting: () => Promise<void>;
  saveGlobalRouting: (data: SaveMailRoutingInput) => Promise<void>;
  savePluginRouting: (pluginKey: string, data: SaveMailRoutingInput) => Promise<void>;
  deletePluginRouting: (pluginKey: string) => Promise<void>;
  saveSettings: (
    providerKey: string,
    data: SaveMailProviderSettingsInput,
  ) => Promise<MailProviderSettings>;
  saveMail: (data: Record<string, unknown>) => Promise<boolean>;
  deleteProvider: (providerKey: string) => Promise<void>;
  testProvider: (
    providerKey: string,
    data: {
      testTo: string;
      useSaved?: boolean;
      secretPrimary?: string | null;
      secretSecondary?: string | null;
      options?: Record<string, string>;
      fields?: Record<string, string>;
    },
  ) => Promise<{ ok: boolean; provider: string; status: string }>;
  getPanelTitle: (mode?: string, item?: MailProviderSettings | null, isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, item?: MailProviderSettings | null) => string;
  getDeleteMessage: (item?: MailProviderSettings | null) => string;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  replaceSelectedIds: (ids: string[]) => void;
  mergeIntoSelection: (ids: string[]) => void;
  deleteHistory: (ids: string[]) => Promise<void>;
}

export const MailContext = createContext<MailContextType | undefined>(undefined);

const EMPTY_MAIL_CONTEXT: MailContextType = {
  isMailPanelOpen: false,
  panelMode: 'create',
  currentMail: null,
  pendingProviderKey: null,
  mailHistory: [],
  totalCount: 0,
  providers: [],
  catalog: [],
  routing: null,
  loading: false,
  routingLoading: false,
  mailContentView: 'list',
  openMailPanel: () => {},
  openMailForEdit: () => {},
  openMailForView: () => {},
  closeMailPanel: () => {},
  openHistoryView: () => {},
  openRoutingView: () => {},
  closeRoutingView: () => {},
  closeMailSettingsView: () => {},
  setPendingProviderKey: () => {},
  loadHistory: async () => {},
  pushMailEntry: () => {},
  loadProviderSettings: async () => {},
  loadCatalog: async () => {},
  loadRouting: async () => {},
  saveGlobalRouting: async () => {},
  savePluginRouting: async () => {},
  deletePluginRouting: async () => {},
  saveSettings: async () => {
    throw new Error('Mail plugin is not available');
  },
  saveMail: async () => false,
  deleteProvider: async () => {},
  testProvider: async () => {
    throw new Error('Mail plugin is not available');
  },
  getPanelTitle: () => '',
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
  selectedIds: [],
  selectedCount: 0,
  isSelected: () => false,
  toggleSelected: () => {},
  selectAll: () => {},
  clearSelection: () => {},
  replaceSelectedIds: () => {},
  mergeIntoSelection: () => {},
  deleteHistory: async () => {},
};

export function MailNullProvider({ children }: { children: React.ReactNode }) {
  return <MailContext.Provider value={EMPTY_MAIL_CONTEXT}>{children}</MailContext.Provider>;
}
