import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { resolveSlug } from '@/core/utils/slugUtils';

import { mailApi } from '../api/mailApi';
import type { MailLogEntry, MailSettings } from '../types/mail';

import { MailContext } from './MailContext';
import type { MailContextType } from './MailContext';

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
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('settings');
  const [currentMail, setCurrentMail] = useState<MailLogEntry | null>(null);
  const [mailHistory, setMailHistory] = useState<MailLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mailContentView, setMailContentView] = useState<'list' | 'settings'>('list');

  useEffect(() => {
    registerPanelCloseFunction('mail', closeMailPanel);
    return () => unregisterPanelCloseFunction('mail');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once on mount
  }, []);

  useEffect(() => {
    (window as any).submitMailForm = () => {
      window.dispatchEvent(new CustomEvent('submitMailForm'));
    };
    (window as any).cancelMailForm = () => {
      window.dispatchEvent(new CustomEvent('cancelMailForm'));
    };
    return () => {
      delete (window as any).submitMailForm;
      delete (window as any).cancelMailForm;
    };
  }, []);

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

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const s = await mailApi.getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load mail settings:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory({ limit: 50 });
      loadSettings();
    } else {
      setMailHistory([]);
      setTotalCount(0);
      setSettings(null);
    }
  }, [isAuthenticated, loadHistory, loadSettings]);

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || mailHistory.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'mail' || !parts[2]) {
      return;
    }
    const segment = parts[2];
    let item = mailHistory.find((i) => String(i.id) === segment);
    if (!item) {
      item = resolveSlug(segment, mailHistory, 'subject') as MailLogEntry | undefined;
    }
    if (item) {
      didOpenFromUrlRef.current = true;
      openMailForViewRef.current(item);
    }
  }, [mailHistory]);

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

  const openMailPanel = () => {
    onCloseOtherPanels();
    setPanelMode('settings');
    setIsMailPanelOpen(true);
  };

  const closeMailPanel = () => {
    setIsMailPanelOpen(false);
    navigateToBase();
  };

  const openMailForView = useCallback(
    (item: MailLogEntry) => {
      onCloseOtherPanels();
      setCurrentMail(item);
      setPanelMode('view');
      setIsMailPanelOpen(true);
      navigateToItem(item, mailHistory, 'subject');
    },
    [onCloseOtherPanels, navigateToItem, mailHistory],
  );

  const openMailForViewRef = useRef(openMailForView);
  useEffect(() => {
    openMailForViewRef.current = openMailForView;
  }, [openMailForView]);

  const openMailsSettings = () => {
    setMailContentView('settings');
  };
  const closeMailSettingsView = () => {
    setMailContentView('list');
  };

  const testSettings = async (data: {
    testTo: string;
    useSaved?: boolean;
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) => {
    if (!isAuthenticated) {
      return;
    }
    await mailApi.testSettings(data);
  };

  const saveSettings = async (data: {
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) => {
    if (!isAuthenticated) {
      return;
    }
    await mailApi.saveSettings(data);
    await loadSettings();
  };

  const getPanelTitle = () => t('mail.panelTitle');
  const getPanelSubtitle = () => '';
  const getDeleteMessage = () => '';

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
    if (extra.length === 0) {
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev.map(String), ...extra])));
  }, []);

  const deleteHistory = useCallback(
    async (ids: string[]) => {
      if (!isAuthenticated || ids.length === 0) {
        return;
      }
      await mailApi.deleteHistory(ids);
      setMailHistory((prev) => prev.filter((e) => !ids.includes(e.id)));
      setTotalCount((prev) => Math.max(0, prev - ids.length));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [isAuthenticated],
  );

  const value: MailContextType = {
    isMailPanelOpen,
    panelMode,
    currentMail,
    mailHistory,
    totalCount,
    settings,
    loading,
    openMailPanel,
    closeMailPanel,
    openMailForView,
    openMailsSettings,
    closeMailSettingsView,
    mailContentView,
    loadHistory,
    pushMailEntry,
    loadSettings,
    testSettings,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    saveSettings,
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
