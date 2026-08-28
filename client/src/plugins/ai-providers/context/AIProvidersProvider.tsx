import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { aiProvidersApi } from '../api/aiProvidersApi';
import { AIProviderDetailHeaderMenus } from '../components/AIProviderDetailHeaderMenus';
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

import { AIProvidersContext, type AIProvidersContextType } from './AIProvidersContext';

interface AIProvidersProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function AIProvidersProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: AIProvidersProviderProps) {
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/ai-providers');

  const [isAIProvidersPanelOpen, setIsAIProvidersPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<AIProvidersPanelMode>('create');
  const [aiProvidersContentView, setAiProvidersContentView] =
    useState<AIProvidersContentView>('list');
  const [currentAIProvider, setCurrentAIProvider] = useState<ProviderSettings | null>(null);
  const [pendingProviderKey, setPendingProviderKey] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderSettings[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [routing, setRouting] = useState<ProviderRoutingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [testingProviderKey, setTestingProviderKey] = useState<string | null>(null);
  const [testResultMessage, setTestResultMessage] = useState<string | null>(null);
  const [testResultError, setTestResultError] = useState<string | null>(null);

  const closeAIProviderPanel = useCallback(() => {
    setIsAIProvidersPanelOpen(false);
    setCurrentAIProvider(null);
    setPendingProviderKey(null);
    setPanelMode('create');
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('ai-providers', closeAIProviderPanel);
    return () => unregisterPanelCloseFunction('ai-providers');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeAIProviderPanel]);

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setLoading(true);
    try {
      const res = await aiProvidersApi.getSettings();
      setProviders(res.providers || []);
    } catch (err) {
      console.error('Failed to load AI provider settings:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadCatalog = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const res = await aiProvidersApi.getCatalog();
      setCatalog(res.providers || []);
    } catch (err) {
      console.error('Failed to load AI provider catalog:', err);
    }
  }, [isAuthenticated]);

  const loadRouting = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setRoutingLoading(true);
    try {
      const res = await aiProvidersApi.getRouting();
      setRouting(res);
    } catch (err) {
      console.error('Failed to load AI provider routing:', err);
    } finally {
      setRoutingLoading(false);
    }
  }, [isAuthenticated]);

  const openRoutingView = useCallback(() => {
    onCloseOtherPanels();
    setAiProvidersContentView('routing');
    // Refresh credentials so newly added/enabled providers appear in selects.
    void loadSettings();
    void loadRouting();
  }, [loadRouting, loadSettings, onCloseOtherPanels]);

  const closeRoutingView = useCallback(() => {
    setAiProvidersContentView('list');
  }, []);

  const saveGlobalRouting = useCallback(
    async (data: SaveProviderRoutingInput) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      await aiProvidersApi.saveGlobalRouting(data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const savePluginRouting = useCallback(
    async (pluginKey: string, data: SaveProviderRoutingInput) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      await aiProvidersApi.savePluginRouting(pluginKey, data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const deletePluginRouting = useCallback(
    async (pluginKey: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      await aiProvidersApi.deletePluginRouting(pluginKey);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  useEffect(() => {
    if (isAuthenticated) {
      void loadSettings();
      void loadCatalog();
    } else {
      setProviders([]);
      setCatalog([]);
      setRouting(null);
    }
  }, [isAuthenticated, loadSettings, loadCatalog]);

  const openAIProviderPanel = useCallback(
    (provider?: ProviderSettings | null) => {
      onCloseOtherPanels();
      setCurrentAIProvider(provider ?? null);
      setPendingProviderKey(provider?.providerKey ?? null);
      setPanelMode(provider ? 'edit' : 'create');
      setIsAIProvidersPanelOpen(true);
    },
    [onCloseOtherPanels],
  );

  const openAIProviderForEdit = useCallback(
    (provider: ProviderSettings) => {
      onCloseOtherPanels();
      setCurrentAIProvider(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('edit');
      setIsAIProvidersPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const openAIProviderForView = useCallback(
    (provider: ProviderSettings) => {
      onCloseOtherPanels();
      setCurrentAIProvider(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('view');
      setIsAIProvidersPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const saveSettings = useCallback(
    async (providerKey: string, data: SaveProviderSettingsInput): Promise<ProviderSettings> => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      const res = await aiProvidersApi.saveSettings(providerKey, data);
      await loadSettings();
      setCurrentAIProvider(res.provider);
      setPendingProviderKey(res.provider.providerKey);
      setPanelMode('view');
      navigateToItem(res.provider, [res.provider, ...providers], (item) => item.providerKey);
      return res.provider;
    },
    [isAuthenticated, loadSettings, navigateToItem, providers],
  );

  const saveAIProvider = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const providerKey = String(
        data.providerKey || pendingProviderKey || currentAIProvider?.providerKey || '',
      ).trim();
      if (!providerKey) {
        return false;
      }
      try {
        await saveSettings(providerKey, {
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : undefined,
          apiKey:
            data.apiKey === undefined
              ? undefined
              : data.apiKey === null
                ? null
                : String(data.apiKey),
          defaultModel: data.defaultModel !== undefined ? String(data.defaultModel) : undefined,
          voiceId:
            data.voiceId === undefined
              ? undefined
              : data.voiceId === null
                ? null
                : String(data.voiceId),
        });
        return true;
      } catch {
        return false;
      }
    },
    [currentAIProvider, pendingProviderKey, saveSettings],
  );

  const deleteProvider = useCallback(
    async (providerKey: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      await aiProvidersApi.deleteSettings(providerKey);
      await loadSettings();
      closeAIProviderPanel();
    },
    [isAuthenticated, loadSettings, closeAIProviderPanel],
  );

  const testConnection = useCallback(
    async (providerKey: string, data: TestConnectionInput): Promise<TestConnectionResult> => {
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      return aiProvidersApi.testConnection(providerKey, data);
    },
    [isAuthenticated],
  );

  const handleTestConnection = useCallback(
    async (provider: ProviderSettings) => {
      setTestingProviderKey(provider.providerKey);
      setTestResultMessage(null);
      setTestResultError(null);
      try {
        const result = await testConnection(provider.providerKey, { useSaved: true });
        setTestResultMessage(
          t('aiProviders.testSuccess', {
            defaultValue: 'Connection OK ({{model}})',
            model: result.model,
          }),
        );
      } catch (err: unknown) {
        setTestResultError(
          (err as Error)?.message ||
            t('aiProviders.testError', { defaultValue: 'Connection test failed' }),
        );
      } finally {
        setTestingProviderKey(null);
      }
    },
    [t, testConnection],
  );

  const getProviderTitle = useCallback(
    (providerKey?: string | null) => {
      if (!providerKey) {
        return '';
      }
      return t(`aiProviders.providers.${providerKey}.title`, {
        defaultValue: providerKey,
      });
    },
    [t],
  );

  const getPanelTitle = useCallback(
    (mode?: string, item?: ProviderSettings | null) => {
      if (mode === 'create') {
        return t('aiProviders.addProvider', { defaultValue: 'Add provider' });
      }
      if (mode === 'view' && item) {
        return <AIProviderDetailHeaderMenus key={item.providerKey} provider={item} />;
      }
      const providerKey = item?.providerKey || currentAIProvider?.providerKey || pendingProviderKey;
      return (
        getProviderTitle(providerKey) ||
        t('aiProviders.panelTitle', { defaultValue: 'AI Providers' })
      );
    },
    [currentAIProvider, getProviderTitle, pendingProviderKey, t],
  );

  const getPanelSubtitle = useCallback(
    (mode?: string, item?: ProviderSettings | null) => {
      if (mode === 'create') {
        return t('aiProviders.createSubtitle', {
          defaultValue: 'Choose a provider type and configure credentials.',
        });
      }
      const providerKey = item?.providerKey || currentAIProvider?.providerKey || pendingProviderKey;
      return t(`aiProviders.providers.${providerKey}.settingsDescription`, {
        defaultValue: '',
      });
    },
    [currentAIProvider, pendingProviderKey, t],
  );

  const getDeleteMessage = useCallback(
    (item?: ProviderSettings | null) => {
      const providerKey = item?.providerKey || currentAIProvider?.providerKey || pendingProviderKey;
      const title = getProviderTitle(providerKey);
      return t('aiProviders.deleteConfirm', {
        defaultValue: 'Delete the {{provider}} configuration? This cannot be undone.',
        provider: title || providerKey || 'provider',
      });
    },
    [currentAIProvider, getProviderTitle, pendingProviderKey, t],
  );

  const value = {
    isAIProvidersPanelOpen,
    panelMode,
    aiProvidersContentView,
    currentAIProvider,
    pendingProviderKey,
    providers,
    catalog,
    routing,
    loading,
    routingLoading,
    openAIProviderPanel,
    openAIProviderForEdit,
    closeAIProviderPanel,
    openAIProviderForView,
    openRoutingView,
    closeRoutingView,
    setPendingProviderKey,
    loadSettings,
    loadCatalog,
    loadRouting,
    saveGlobalRouting,
    savePluginRouting,
    deletePluginRouting,
    saveSettings,
    saveAIProvider,
    deleteProvider,
    testConnection,
    testingProviderKey,
    testResultMessage,
    testResultError,
    handleTestConnection,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    'ai-providers': providers,
  } as AIProvidersContextType & { 'ai-providers': ProviderSettings[] };

  return <AIProvidersContext.Provider value={value}>{children}</AIProvidersContext.Provider>;
}
