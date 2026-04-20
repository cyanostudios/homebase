import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { pulseApi } from '../api/pulseApi';
import type { PulseLogEntry, PulseSettings } from '../types/pulse';

import { PulseContext } from './PulseContext';
import type { PulseContextType } from './PulseContext';

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
  const { navigateToBase } = useItemUrl('/pulses');

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
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
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
    activeProvider?: 'twilio' | 'mock' | 'apple-messages';
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
    replaceSelectedIds,
    mergeIntoSelection,
    deleteHistory,
  };

  return <PulseContext.Provider value={value}>{children}</PulseContext.Provider>;
}
