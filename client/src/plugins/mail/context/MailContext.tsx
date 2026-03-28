import React, { createContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { mailApi } from '../api/mailApi';
import type { MailLogEntry, MailSettings } from '../types/mail';

interface MailContextType {
  isMailPanelOpen: boolean;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  currentMail: MailLogEntry | null;
  mailHistory: MailLogEntry[];
  totalCount: number;
  settings: MailSettings | null;
  loading: boolean;
  openMailPanel: () => void;
  closeMailPanel: () => void;
  openMailForView: (item: MailLogEntry) => void;
  openMailsSettings: () => void;
  closeMailSettingsView: () => void;
  mailContentView: 'list' | 'settings';
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushMailEntry: (entry: MailLogEntry) => void;
  loadSettings: () => Promise<void>;
  testSettings: (data: {
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
  }) => Promise<void>;
  getPanelTitle: (mode: string, _item?: any, _isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, _item?: any) => string;
  getDeleteMessage: (_item?: any) => string;
  saveSettings: (data: {
    provider?: 'smtp' | 'resend';
    host?: string;
    port?: number;
    secure?: boolean;
    authUser?: string;
    authPass?: string;
    fromAddress?: string;
    resendApiKey?: string;
    resendFromAddress?: string;
  }) => Promise<void>;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** Replace selection (e.g. select-all-visible / union with filter). */
  replaceSelectedIds: (ids: string[]) => void;
  deleteHistory: (ids: string[]) => Promise<void>;
}

const MailContext = createContext<MailContextType | undefined>(undefined);

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
    if (parts[1] !== 'mail' || !parts[2] || isNaN(Number(parts[2]))) {
      return;
    }
    const item = mailHistory.find((i) => String(i.id) === parts[2]);
    if (item) {
      didOpenFromUrlRef.current = true;
      openMailForViewRef.current(item);
    }
  }, [mailHistory]);

  // Listen for mail sent from other plugins (e.g. Inspection) – push to cache without refetch
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
      navigateToItem(item.id);
    },
    [onCloseOtherPanels, navigateToItem],
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
    deleteHistory,
  };

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}

export { MailContext };
