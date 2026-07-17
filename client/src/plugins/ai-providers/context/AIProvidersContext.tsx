import React, { createContext } from 'react';

import type {
  AIProvidersContentView,
  AIProvidersPanelMode,
  ProviderCatalogEntry,
  ProviderRoutingResponse,
  ProviderSettings,
  SaveProviderRoutingInput,
  SaveProviderSettingsInput,
  TestConnectionInput,
  TestConnectionResult,
} from '../types/aiProviders';

export interface AIProvidersContextType {
  isAIProvidersPanelOpen: boolean;
  panelMode: AIProvidersPanelMode;
  aiProvidersContentView: AIProvidersContentView;
  currentAIProvider: ProviderSettings | null;
  pendingProviderKey: string | null;
  providers: ProviderSettings[];
  catalog: ProviderCatalogEntry[];
  routing: ProviderRoutingResponse | null;
  loading: boolean;
  routingLoading: boolean;
  openAIProviderPanel: (provider?: ProviderSettings | null) => void;
  openAIProviderForEdit: (provider: ProviderSettings) => void;
  closeAIProviderPanel: () => void;
  openAIProviderForView: (item: ProviderSettings) => void;
  openRoutingView: () => void;
  closeRoutingView: () => void;
  setPendingProviderKey: (providerKey: string | null) => void;
  loadSettings: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  loadRouting: () => Promise<void>;
  saveGlobalRouting: (data: SaveProviderRoutingInput) => Promise<void>;
  savePluginRouting: (pluginKey: string, data: SaveProviderRoutingInput) => Promise<void>;
  deletePluginRouting: (pluginKey: string) => Promise<void>;
  saveSettings: (providerKey: string, data: SaveProviderSettingsInput) => Promise<ProviderSettings>;
  /** PanelHandlers convention: `saveAIProvider(data)` → boolean. */
  saveAIProvider: (data: Record<string, unknown>) => Promise<boolean>;
  deleteProvider: (providerKey: string) => Promise<void>;
  testConnection: (providerKey: string, data: TestConnectionInput) => Promise<TestConnectionResult>;
  getPanelTitle: (mode?: string, item?: ProviderSettings | null, isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, item?: ProviderSettings | null) => string;
  getDeleteMessage: (item?: ProviderSettings | null) => string;
}

export const AIProvidersContext = createContext<AIProvidersContextType | undefined>(undefined);

const EMPTY_AI_PROVIDERS_CONTEXT: AIProvidersContextType = {
  isAIProvidersPanelOpen: false,
  panelMode: 'create',
  aiProvidersContentView: 'list',
  currentAIProvider: null,
  pendingProviderKey: null,
  providers: [],
  catalog: [],
  routing: null,
  loading: false,
  routingLoading: false,
  openAIProviderPanel: () => {},
  openAIProviderForEdit: () => {},
  closeAIProviderPanel: () => {},
  openAIProviderForView: () => {},
  openRoutingView: () => {},
  closeRoutingView: () => {},
  setPendingProviderKey: () => {},
  loadSettings: async () => {},
  loadCatalog: async () => {},
  loadRouting: async () => {},
  saveGlobalRouting: async () => {},
  savePluginRouting: async () => {},
  deletePluginRouting: async () => {},
  saveSettings: async () => {
    throw new Error('AI Providers plugin is not available');
  },
  saveAIProvider: async () => {
    throw new Error('AI Providers plugin is not available');
  },
  deleteProvider: async () => {
    throw new Error('AI Providers plugin is not available');
  },
  testConnection: async () => {
    throw new Error('AI Providers plugin is not available');
  },
  getPanelTitle: () => '',
  getPanelSubtitle: () => '',
  getDeleteMessage: () => '',
};

export function AIProvidersNullProvider({ children }: { children: React.ReactNode }) {
  return (
    <AIProvidersContext.Provider value={EMPTY_AI_PROVIDERS_CONTEXT}>
      {children}
    </AIProvidersContext.Provider>
  );
}
