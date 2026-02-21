import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';

import { pulseApi } from '../api/pulseApi';
import type { PulseLogEntry, PulseSettings } from '../types/pulse';

interface PulseContextType {
  isPulsesPanelOpen: boolean;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  currentPulse: null;
  pulseHistory: PulseLogEntry[];
  totalCount: number;
  settings: PulseSettings | null;
  loading: boolean;
  openPulsePanel: () => void;
  closePulsePanel: () => void;
  openPulseForView: (_item: unknown) => void;
  openPulsesSettings: () => void;
  closePulseSettingsView: () => void;
  pulsesContentView: 'list' | 'settings';
  loadHistory: (params?: {
    limit?: number;
    offset?: number;
    pluginSource?: string;
  }) => Promise<void>;
  pushPulseEntry: (entry: PulseLogEntry) => void;
  loadSettings: () => Promise<void>;
  testSettings: (data: {
    testTo: string;
    useSaved?: boolean;
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => Promise<void>;
  getPanelTitle: (mode: string, _item?: unknown, _isMobile?: boolean) => string;
  getPanelSubtitle: (mode?: string, _item?: unknown) => string;
  getDeleteMessage: (_item?: unknown) => string;
  saveSettings: (data: {
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => Promise<void>;
  selectedIds: string[];
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteHistory: (ids: string[]) => Promise<void>;
}

const PulseContext = createContext<PulseContextType | undefined>(undefined);

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

  const [isPulsesPanelOpen, setIsPulsesPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('settings');
  const [pulseHistory, setPulseHistory] = useState<PulseLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [settings, setSettings] = useState<PulseSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pulsesContentView, setPulsesContentView] = useState<'list' | 'settings'>('list');

  const closePulsePanel = useCallback(() => {
    setIsPulsesPanelOpen(false);
  }, []);

  useEffect(() => {
    registerPanelCloseFunction('pulses', closePulsePanel);
    return () => unregisterPanelCloseFunction('pulses');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closePulsePanel]);

  useEffect(() => {
    const submitFn = () => window.dispatchEvent(new CustomEvent('submitPulseForm'));
    const cancelFn = () => window.dispatchEvent(new CustomEvent('cancelPulseForm'));
    (window as any).submitPulseForm = submitFn;
    (window as any).submitPulsesForm = submitFn; // footer looks for submit + Cap(pluginName) + Form => submitPulsesForm
    (window as any).cancelPulseForm = cancelFn;
    (window as any).cancelPulsesForm = cancelFn;
    return () => {
      delete (window as any).submitPulseForm;
      delete (window as any).submitPulsesForm;
      delete (window as any).cancelPulseForm;
      delete (window as any).cancelPulsesForm;
    };
  }, []);

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

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const s = await pulseApi.getSettings();
      setSettings(s);
    } catch (err) {
      console.error('Failed to load pulse settings:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory({ limit: 50 });
      loadSettings();
    } else {
      setPulseHistory([]);
      setTotalCount(0);
      setSettings(null);
    }
  }, [isAuthenticated, loadHistory, loadSettings]);

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

  const openPulsePanel = () => {
    onCloseOtherPanels();
    setPanelMode('settings');
    setIsPulsesPanelOpen(true);
  };

  const openPulseForView = () => {
    onCloseOtherPanels();
    setPanelMode('view');
    setIsPulsesPanelOpen(true);
  };

  const openPulsesSettings = () => {
    setPulsesContentView('settings');
  };
  const closePulseSettingsView = () => {
    setPulsesContentView('list');
  };

  const testSettings = async (data: {
    testTo: string;
    useSaved?: boolean;
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => {
    if (!isAuthenticated) {
      return;
    }
    await pulseApi.testSettings(data);
  };

  const saveSettings = async (data: {
    activeProvider?: 'twilio' | 'mock';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  }) => {
    if (!isAuthenticated) {
      return;
    }
    await pulseApi.saveSettings(data);
    await loadSettings();
  };

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

  const deleteHistory = useCallback(
    async (ids: string[]) => {
      if (!isAuthenticated || ids.length === 0) {
        return;
      }
      await pulseApi.deleteHistory(ids);
      setPulseHistory((prev) => prev.filter((e) => !ids.includes(e.id)));
      setTotalCount((prev) => Math.max(0, prev - ids.length));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [isAuthenticated],
  );

  const getPanelTitle = () => t('pulses.panelTitle');
  const getPanelSubtitle = () => '';
  const getDeleteMessage = () => '';

  const value: PulseContextType = {
    isPulsesPanelOpen,
    panelMode,
    currentPulse: null,
    pulseHistory,
    totalCount,
    settings,
    loading,
    openPulsePanel,
    closePulsePanel,
    openPulseForView,
    openPulsesSettings,
    closePulseSettingsView,
    pulsesContentView,
    loadHistory,
    pushPulseEntry,
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
    deleteHistory,
  };

  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}

export { PulseContext };
