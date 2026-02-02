import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useApp } from '@/core/api/AppContext';
import { mailApi } from '../api/mailApi';
import type { MailLogEntry, MailSettings } from '../types/mail';

interface MailContextType {
  isMailPanelOpen: boolean;
  mailHistory: MailLogEntry[];
  totalCount: number;
  settings: MailSettings | null;
  loading: boolean;
  openMailPanel: () => void;
  closeMailPanel: () => void;
  loadHistory: (params?: { limit?: number; offset?: number; pluginSource?: string }) => Promise<void>;
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
}

const MailContext = createContext<MailContextType | undefined>(undefined);

interface MailProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function MailProvider({ children, isAuthenticated, onCloseOtherPanels }: MailProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isMailPanelOpen, setIsMailPanelOpen] = useState(false);
  const [mailHistory, setMailHistory] = useState<MailLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    registerPanelCloseFunction('mail', closeMailPanel);
    return () => unregisterPanelCloseFunction('mail');
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
      if (!isAuthenticated) return;
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
    [isAuthenticated]
  );

  const pushMailEntry = useCallback((entry: MailLogEntry) => {
    if (entry?.id) {
      setMailHistory((prev) => [entry, ...prev]);
      setTotalCount((prev) => prev + 1);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) return;
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
    setIsMailPanelOpen(true);
  };

  const closeMailPanel = () => {
    setIsMailPanelOpen(false);
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
    if (!isAuthenticated) return;
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
    if (!isAuthenticated) return;
    await mailApi.saveSettings(data);
    await loadSettings();
  };

  const getPanelTitle = () => 'SMTP-inställningar';
  const getPanelSubtitle = () => '';
  const getDeleteMessage = () => '';

  const value: MailContextType = {
    isMailPanelOpen,
    mailHistory,
    totalCount,
    settings,
    loading,
    openMailPanel,
    closeMailPanel,
    loadHistory,
    pushMailEntry,
    loadSettings,
    testSettings,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
    saveSettings,
  };

  return <MailContext.Provider value={value}>{children}</MailContext.Provider>;
}

export { MailContext };
