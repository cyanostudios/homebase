import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { pulseApi } from '../api/pulseApi';
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

import { PulseContext, type PulseContextType } from './PulseContext';

interface PulseProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function PulseProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: PulseProviderProps) {
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/pulses');

  const [isPulsesPanelOpen, setIsPulsesPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PulsePanelMode>('create');
  const [currentPulse, setCurrentPulse] = useState<PulseProviderSettings | null>(null);
  const [pendingProviderKey, setPendingProviderKey] = useState<string | null>(null);
  const [pulseHistory, setPulseHistory] = useState<PulseLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [providers, setProviders] = useState<PulseProviderSettings[]>([]);
  const [catalog, setCatalog] = useState<PulseCatalogEntry[]>([]);
  const [routing, setRouting] = useState<PulseRoutingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pulsesContentView, setPulsesContentView] = useState<PulsesContentView>('list');

  const closePulsePanel = useCallback(() => {
    setIsPulsesPanelOpen(false);
    setCurrentPulse(null);
    setPendingProviderKey(null);
    setPanelMode('create');
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('pulses', closePulsePanel);
    return () => unregisterPanelCloseFunction('pulses');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closePulsePanel]);

  const loadHistory = useCallback(
    async (params?: { limit?: number; offset?: number; pluginSource?: string }) => {
      if (!isAuthenticated) {
        return;
      }
      setLoading(true);
      try {
        const res = await pulseApi.getHistory({ limit: 50, offset: 0, ...params });
        setPulseHistory(res.items || []);
        setTotalCount(res.total ?? 0);
      } catch (err) {
        console.error('Failed to load pulse history:', err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  const pushPulseEntry = useCallback((entry: PulseLogEntry) => {
    if (entry?.id) {
      setPulseHistory((prev) => [entry, ...prev]);
      setTotalCount((prev) => prev + 1);
    }
  }, []);

  const loadProviderSettings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const res = await pulseApi.getProviderSettings();
      setProviders(res.providers || []);
    } catch (err) {
      console.error('Failed to load Pulse provider settings:', err);
    }
  }, [isAuthenticated]);

  const loadCatalog = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const res = await pulseApi.getCatalog();
      setCatalog(res.providers || []);
    } catch (err) {
      console.error('Failed to load Pulse provider catalog:', err);
    }
  }, [isAuthenticated]);

  const loadRouting = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setRoutingLoading(true);
    try {
      const res = await pulseApi.getRouting();
      setRouting(res);
    } catch (err) {
      console.error('Failed to load Pulse provider routing:', err);
    } finally {
      setRoutingLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadHistory({ limit: 50 });
      void loadProviderSettings();
      void loadCatalog();
      void loadRouting();
    } else {
      setPulseHistory([]);
      setTotalCount(0);
      setProviders([]);
      setCatalog([]);
      setRouting(null);
    }
  }, [isAuthenticated, loadHistory, loadProviderSettings, loadCatalog, loadRouting]);

  useEffect(() => {
    const onPulseSent = (e: CustomEvent<PulseLogEntry>) => {
      const entry = e.detail;
      if (entry?.id) {
        setPulseHistory((prev) => [entry, ...prev]);
        setTotalCount((prev) => prev + 1);
      }
    };
    window.addEventListener('pulseSent' as any, onPulseSent);
    return () => window.removeEventListener('pulseSent' as any, onPulseSent);
  }, []);

  const openHistoryView = useCallback(() => {
    onCloseOtherPanels();
    setPulsesContentView('history');
    void loadHistory({ limit: 50 });
  }, [loadHistory, onCloseOtherPanels]);

  const openRoutingView = useCallback(() => {
    onCloseOtherPanels();
    setPulsesContentView('routing');
    void loadProviderSettings();
    void loadRouting();
  }, [loadProviderSettings, loadRouting, onCloseOtherPanels]);

  const closeRoutingView = useCallback(() => {
    setPulsesContentView('list');
  }, []);

  /** Main provider list — also used by AppContent page-change cleanup. */
  const closePulseSettingsView = useCallback(() => {
    setPulsesContentView('list');
  }, []);

  const openPulsePanel = useCallback(
    (provider?: PulseProviderSettings | null) => {
      onCloseOtherPanels();
      setPulsesContentView('list');
      setCurrentPulse(provider ?? null);
      setPendingProviderKey(provider?.providerKey ?? null);
      setPanelMode(provider ? 'edit' : 'create');
      setIsPulsesPanelOpen(true);
    },
    [onCloseOtherPanels],
  );

  const openPulseForEdit = useCallback(
    (provider: PulseProviderSettings) => {
      onCloseOtherPanels();
      setPulsesContentView('list');
      setCurrentPulse(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('edit');
      setIsPulsesPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const openPulseForView = useCallback(
    (provider: PulseProviderSettings) => {
      onCloseOtherPanels();
      setPulsesContentView('list');
      setCurrentPulse(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('view');
      setIsPulsesPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const saveGlobalRouting = useCallback(
    async (data: SavePulseRoutingInput) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await pulseApi.saveGlobalRouting(data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const savePluginRouting = useCallback(
    async (pluginKey: string, data: SavePulseRoutingInput) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await pulseApi.savePluginRouting(pluginKey, data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const deletePluginRouting = useCallback(
    async (pluginKey: string) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await pulseApi.deletePluginRouting(pluginKey);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const saveSettings = useCallback(
    async (
      providerKey: string,
      data: SavePulseProviderSettingsInput,
    ): Promise<PulseProviderSettings> => {
      if (!isAuthenticated) throw new Error('Authentication required');
      const res = await pulseApi.saveProviderSettings(providerKey, data);
      await loadProviderSettings();
      setCurrentPulse(res.provider);
      setPendingProviderKey(res.provider.providerKey);
      setPanelMode('view');
      navigateToItem(res.provider, [res.provider, ...providers], (item) => item.providerKey);
      return res.provider;
    },
    [isAuthenticated, loadProviderSettings, navigateToItem, providers],
  );

  const savePulse = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const providerKey = String(
        data.providerKey || pendingProviderKey || currentPulse?.providerKey || '',
      ).trim();
      if (!providerKey) {
        return false;
      }
      try {
        await saveSettings(providerKey, {
          enabled: data.enabled !== undefined ? Boolean(data.enabled) : undefined,
          secretPrimary:
            data.secretPrimary === undefined
              ? undefined
              : data.secretPrimary === null
                ? null
                : String(data.secretPrimary),
          secretSecondary:
            data.secretSecondary === undefined
              ? undefined
              : data.secretSecondary === null
                ? null
                : String(data.secretSecondary),
          options:
            data.options && typeof data.options === 'object'
              ? (data.options as Record<string, string | null>)
              : undefined,
          fields:
            data.fields && typeof data.fields === 'object'
              ? (data.fields as Record<string, string | null>)
              : undefined,
        });
        return true;
      } catch {
        return false;
      }
    },
    [currentPulse, pendingProviderKey, saveSettings],
  );

  const deleteProvider = useCallback(
    async (providerKey: string) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await pulseApi.deleteProviderSettings(providerKey);
      await loadProviderSettings();
      closePulsePanel();
    },
    [closePulsePanel, isAuthenticated, loadProviderSettings],
  );

  const testProvider = useCallback(
    async (
      providerKey: string,
      data: {
        testTo: string;
        useSaved?: boolean;
        secretPrimary?: string | null;
        secretSecondary?: string | null;
        options?: Record<string, string>;
        fields?: Record<string, string>;
      },
    ) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      return pulseApi.testProviderSettings(providerKey, data);
    },
    [isAuthenticated],
  );

  const selectedCount = selectedIds.length;
  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const selectAll = useCallback(() => {
    setSelectedIds(pulseHistory.map((e) => e.id));
  }, [pulseHistory]);
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);
  const replaceSelectedIds = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
  const mergeIntoSelection = useCallback((ids: string[]) => {
    const extra = Array.isArray(ids) ? ids.map(String) : [];
    if (extra.length === 0) return;
    setSelectedIds((prev) => Array.from(new Set([...prev.map(String), ...extra])));
  }, []);

  const deleteHistory = useCallback(
    async (ids: string[]) => {
      if (!isAuthenticated || ids.length === 0) return;
      await pulseApi.deleteHistory(ids);
      setPulseHistory((prev) => prev.filter((e) => !ids.includes(e.id)));
      setTotalCount((prev) => Math.max(0, prev - ids.length));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [isAuthenticated],
  );

  const getPanelTitle = useCallback(
    (mode?: string, item?: PulseProviderSettings | null) => {
      const provider = item ?? currentPulse;
      const key = provider?.providerKey || pendingProviderKey;
      if (mode === 'create' || (!provider && !key)) {
        return t('pulses.addProvider', { defaultValue: 'Add provider' });
      }
      return t(`pulses.providers.${key}.title`, { defaultValue: key || t('pulses.panelTitle') });
    },
    [currentPulse, pendingProviderKey, t],
  );

  const getPanelSubtitle = useCallback(
    (mode?: string, item?: PulseProviderSettings | null) => {
      if (mode === 'create') {
        return t('pulses.createSubtitle', { defaultValue: 'Configure an SMS or verify provider' });
      }
      const provider = item ?? currentPulse;
      if (!provider?.smsNotificationCapable) {
        return t('pulses.notSmsRoutableHint', {
          defaultValue: 'Credentials only — not available for SMS routing in v1',
        });
      }
      return '';
    },
    [currentPulse, t],
  );

  const getDeleteMessage = useCallback(
    (item?: PulseProviderSettings | null) => {
      const provider = item ?? currentPulse;
      const title = provider
        ? t(`pulses.providers.${provider.providerKey}.title`, {
            defaultValue: provider.providerKey,
          })
        : t('pulses.panelTitle');
      return t('pulses.deleteConfirm', {
        defaultValue: 'Delete provider "{{name}}"? Credentials will be removed.',
        name: title,
      });
    },
    [currentPulse, t],
  );

  const value: PulseContextType = {
    isPulsesPanelOpen,
    panelMode,
    currentPulse,
    pendingProviderKey,
    pulseHistory,
    totalCount,
    providers,
    catalog,
    routing,
    loading,
    routingLoading,
    pulsesContentView,
    openPulsePanel,
    openPulseForEdit,
    openPulseForView,
    closePulsePanel,
    openHistoryView,
    openRoutingView,
    closeRoutingView,
    closePulseSettingsView,
    setPendingProviderKey,
    loadHistory,
    pushPulseEntry,
    loadProviderSettings,
    loadCatalog,
    loadRouting,
    saveGlobalRouting,
    savePluginRouting,
    deletePluginRouting,
    saveSettings,
    savePulse,
    deleteProvider,
    testProvider,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelected,
    selectAll,
    clearSelection,
    replaceSelectedIds,
    mergeIntoSelection,
    deleteHistory,
  };

  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}
