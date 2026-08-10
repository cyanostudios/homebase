import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { mailApi } from '../api/mailApi';
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

import { MailContext, type MailContextType } from './MailContext';

interface MailProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function MailProvider({ children, isAuthenticated, onCloseOtherPanels }: MailProviderProps) {
  const { t } = useTranslation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/mail');

  const [isMailPanelOpen, setIsMailPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<MailPanelMode>('create');
  const [currentMail, setCurrentMail] = useState<MailProviderSettings | null>(null);
  const [pendingProviderKey, setPendingProviderKey] = useState<string | null>(null);
  const [mailHistory, setMailHistory] = useState<MailLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [providers, setProviders] = useState<MailProviderSettings[]>([]);
  const [catalog, setCatalog] = useState<MailCatalogEntry[]>([]);
  const [routing, setRouting] = useState<MailRoutingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mailContentView, setMailContentView] = useState<MailContentView>('list');

  const closeMailPanel = useCallback(() => {
    setIsMailPanelOpen(false);
    setCurrentMail(null);
    setPendingProviderKey(null);
    setPanelMode('create');
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('mail', closeMailPanel);
    return () => unregisterPanelCloseFunction('mail');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeMailPanel]);

  const loadHistory = useCallback(
    async (params?: { limit?: number; offset?: number; pluginSource?: string }) => {
      if (!isAuthenticated) {
        return;
      }
      setLoading(true);
      try {
        const res = await mailApi.getHistory({ limit: 50, offset: 0, ...params });
        setMailHistory(res.items || []);
        setTotalCount(res.total ?? 0);
      } catch (err) {
        console.error('Failed to load mail history:', err);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  const pushMailEntry = useCallback((entry: MailLogEntry) => {
    if (entry?.id) {
      setMailHistory((prev) => [entry, ...prev]);
      setTotalCount((prev) => prev + 1);
    }
  }, []);

  const loadProviderSettings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const res = await mailApi.getProviderSettings();
      setProviders(res.providers || []);
    } catch (err) {
      console.error('Failed to load mail provider settings:', err);
    }
  }, [isAuthenticated]);

  const loadCatalog = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const res = await mailApi.getCatalog();
      setCatalog(res.providers || []);
    } catch (err) {
      console.error('Failed to load mail provider catalog:', err);
    }
  }, [isAuthenticated]);

  const loadRouting = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setRoutingLoading(true);
    try {
      const res = await mailApi.getRouting();
      setRouting(res);
    } catch (err) {
      console.error('Failed to load mail provider routing:', err);
    } finally {
      setRoutingLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadProviderSettings();
      void loadCatalog();
      void loadRouting();
    } else {
      setMailHistory([]);
      setTotalCount(0);
      setProviders([]);
      setCatalog([]);
      setRouting(null);
    }
  }, [isAuthenticated, loadProviderSettings, loadCatalog, loadRouting]);

  useEffect(() => {
    const onMailSent = (e: CustomEvent<MailLogEntry>) => {
      const entry = e.detail;
      if (entry?.id) {
        setMailHistory((prev) => [entry, ...prev]);
        setTotalCount((prev) => prev + 1);
      }
    };
    window.addEventListener('mailSent' as any, onMailSent);
    return () => window.removeEventListener('mailSent' as any, onMailSent);
  }, []);

  const openHistoryView = useCallback(() => {
    onCloseOtherPanels();
    setMailContentView('history');
    void loadHistory({ limit: 50 });
  }, [loadHistory, onCloseOtherPanels]);

  const openRoutingView = useCallback(() => {
    onCloseOtherPanels();
    setMailContentView('routing');
    void loadProviderSettings();
    void loadRouting();
  }, [loadProviderSettings, loadRouting, onCloseOtherPanels]);

  const closeRoutingView = useCallback(() => {
    setMailContentView('list');
  }, []);

  const closeMailSettingsView = useCallback(() => {
    setMailContentView('list');
  }, []);

  const openMailPanel = useCallback(
    (provider?: MailProviderSettings | null) => {
      onCloseOtherPanels();
      setMailContentView('list');
      setCurrentMail(provider ?? null);
      setPendingProviderKey(provider?.providerKey ?? null);
      setPanelMode(provider ? 'edit' : 'create');
      setIsMailPanelOpen(true);
    },
    [onCloseOtherPanels],
  );

  const openMailForEdit = useCallback(
    (provider: MailProviderSettings) => {
      onCloseOtherPanels();
      setMailContentView('list');
      setCurrentMail(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('edit');
      setIsMailPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const openMailForView = useCallback(
    (provider: MailProviderSettings) => {
      onCloseOtherPanels();
      setMailContentView('list');
      setCurrentMail(provider);
      setPendingProviderKey(provider.providerKey);
      setPanelMode('view');
      setIsMailPanelOpen(true);
      navigateToItem(provider, providers, (item) => item.providerKey);
    },
    [navigateToItem, onCloseOtherPanels, providers],
  );

  const saveGlobalRouting = useCallback(
    async (data: SaveMailRoutingInput) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await mailApi.saveGlobalRouting(data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const savePluginRouting = useCallback(
    async (pluginKey: string, data: SaveMailRoutingInput) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await mailApi.savePluginRouting(pluginKey, data);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const deletePluginRouting = useCallback(
    async (pluginKey: string) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await mailApi.deletePluginRouting(pluginKey);
      await loadRouting();
    },
    [isAuthenticated, loadRouting],
  );

  const saveSettings = useCallback(
    async (
      providerKey: string,
      data: SaveMailProviderSettingsInput,
    ): Promise<MailProviderSettings> => {
      if (!isAuthenticated) throw new Error('Authentication required');
      const res = await mailApi.saveProviderSettings(providerKey, data);
      await loadProviderSettings();
      setCurrentMail(res.provider);
      setPendingProviderKey(res.provider.providerKey);
      setPanelMode('view');
      navigateToItem(res.provider, [res.provider, ...providers], (item) => item.providerKey);
      return res.provider;
    },
    [isAuthenticated, loadProviderSettings, navigateToItem, providers],
  );

  const saveMail = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      const providerKey = String(
        data.providerKey || pendingProviderKey || currentMail?.providerKey || '',
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
    [currentMail, pendingProviderKey, saveSettings],
  );

  const deleteProvider = useCallback(
    async (providerKey: string) => {
      if (!isAuthenticated) throw new Error('Authentication required');
      await mailApi.deleteProviderSettings(providerKey);
      await loadProviderSettings();
      closeMailPanel();
    },
    [closeMailPanel, isAuthenticated, loadProviderSettings],
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
      return mailApi.testProviderSettings(providerKey, data);
    },
    [isAuthenticated],
  );

  const selectedCount = selectedIds.length;
  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const selectAll = useCallback(() => {
    setSelectedIds(mailHistory.map((e) => e.id));
  }, [mailHistory]);
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
      await mailApi.deleteHistory(ids);
      setMailHistory((prev) => prev.filter((e) => !ids.includes(e.id)));
      setTotalCount((prev) => Math.max(0, prev - ids.length));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [isAuthenticated],
  );

  const getPanelTitle = useCallback(
    (mode?: string, item?: MailProviderSettings | null) => {
      const provider = item ?? currentMail;
      const key = provider?.providerKey || pendingProviderKey;
      if (mode === 'create' || (!provider && !key)) {
        return t('mail.addProvider', { defaultValue: 'Add provider' });
      }
      return t(`mail.providers.${key}.title`, { defaultValue: key || t('mail.panelTitle') });
    },
    [currentMail, pendingProviderKey, t],
  );

  const getPanelSubtitle = useCallback(
    (mode?: string, item?: MailProviderSettings | null) => {
      if (mode === 'create') {
        return t('mail.createSubtitle', { defaultValue: 'Configure an email provider' });
      }
      const provider = item ?? currentMail;
      if (!provider?.emailCapable) {
        return '';
      }
      return '';
    },
    [currentMail, t],
  );

  const getDeleteMessage = useCallback(
    (item?: MailProviderSettings | null) => {
      const provider = item ?? currentMail;
      const title = provider
        ? t(`mail.providers.${provider.providerKey}.title`, {
            defaultValue: provider.providerKey,
          })
        : t('mail.panelTitle');
      return t('mail.deleteConfirm', {
        defaultValue: 'Delete provider "{{name}}"? Credentials will be removed.',
        name: title,
      });
    },
    [currentMail, t],
  );

  const value: MailContextType = {
    isMailPanelOpen,
    panelMode,
    currentMail,
    pendingProviderKey,
    mailHistory,
    totalCount,
    providers,
    catalog,
    routing,
    loading,
    routingLoading,
    mailContentView,
    openMailPanel,
    openMailForEdit,
    openMailForView,
    closeMailPanel,
    openHistoryView,
    openRoutingView,
    closeRoutingView,
    closeMailSettingsView,
    setPendingProviderKey,
    loadHistory,
    pushMailEntry,
    loadProviderSettings,
    loadCatalog,
    loadRouting,
    saveGlobalRouting,
    savePluginRouting,
    deletePluginRouting,
    saveSettings,
    saveMail,
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

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}
