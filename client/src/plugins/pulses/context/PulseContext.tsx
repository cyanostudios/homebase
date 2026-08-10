import React, { createContext } from 'react';

import type {
  PulseCatalogEntry,
  PulseLogEntry,
  PulsePanelMode,
  PulseProviderSettings,
  PulseRoutingResponse,
  PulsesContentView,
  SavePulseProviderSettingsInput,
  SavePulseRoutingInput,
} from '../types/pulse';

export interface PulseContextType {
  isPulsesPanelOpen: boolean;
  panelMode: PulsePanelMode;
  currentPulse: PulseProviderSettings | null;
  pendingProviderKey: string | null;
  pulseHistory: PulseLogEntry[];
  totalCount: number;
  providers: PulseProviderSettings[];
  catalog: PulseCatalogEntry[];
  routing: PulseRoutingResponse | null;
  loading: boolean;
  routingLoading: boolean;
  pulsesContentView: PulsesContentView;
  openPulsePanel: (provider?: PulseProviderSettings | null) => void;
  openPulseForEdit: (provider: PulseProviderSettings) => void;
  openPulseForView: (provider: PulseProviderSettings) => void;
  closePulsePanel: () => void;
  openHistoryView: () => void;
  openRoutingView: () => void;
  closeRoutingView: () => void;
  /** Reset to main provider list (used by AppContent page-change cleanup). */
  closePulseSettingsView: () => void;
  setPendingProviderKey: (providerKey: string | null) => void;
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushPulseEntry: (entry: PulseLogEntry) => void;
  loadProviderSettings: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  loadRouting: () => Promise<void>;
  saveGlobalRouting: (data: SavePulseRoutingInput) => Promise<void>;
  savePluginRouting: (pluginKey: string, data: SavePulseRoutingInput) => Promise<void>;
  deletePluginRouting: (pluginKey: string) => Promise<void>;
  saveSettings: (
    providerKey: string,
    data: SavePulseProviderSettingsInput,
  ) => Promise<PulseProviderSettings>;
  savePulse: (data: Record<string, unknown>) => Promise<boolean>;
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
  getPanelTitle: (mode?: string, item?: PulseProviderSettings | null, isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, item?: PulseProviderSettings | null) => string;
  getDeleteMessage: (item?: PulseProviderSettings | null) => string;
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

export const PulseContext = createContext<PulseContextType | undefined>(undefined);

const EMPTY_PULSE_CONTEXT: PulseContextType = {
  isPulsesPanelOpen: false,
  panelMode: 'create',
  currentPulse: null,
  pendingProviderKey: null,
  pulseHistory: [],
  totalCount: 0,
  providers: [],
  catalog: [],
  routing: null,
  loading: false,
  routingLoading: false,
  pulsesContentView: 'list',
  openPulsePanel: () => {},
  openPulseForEdit: () => {},
  openPulseForView: () => {},
  closePulsePanel: () => {},
  openHistoryView: () => {},
  openRoutingView: () => {},
  closeRoutingView: () => {},
  closePulseSettingsView: () => {},
  setPendingProviderKey: () => {},
  loadHistory: async () => {},
  pushPulseEntry: () => {},
  loadProviderSettings: async () => {},
  loadCatalog: async () => {},
  loadRouting: async () => {},
  saveGlobalRouting: async () => {},
  savePluginRouting: async () => {},
  deletePluginRouting: async () => {},
  saveSettings: async () => {
    throw new Error('Pulse plugin is not available');
  },
  savePulse: async () => false,
  deleteProvider: async () => {},
  testProvider: async () => {
    throw new Error('Pulse plugin is not available');
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

export function PulseNullProvider({ children }: { children: React.ReactNode }) {
  return <PulseContext.Provider value={EMPTY_PULSE_CONTEXT}>{children}</PulseContext.Provider>;
}
