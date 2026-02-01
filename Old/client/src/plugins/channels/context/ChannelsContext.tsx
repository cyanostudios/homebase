import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

import { useApp } from '@/core/api/AppContext';

import { channelsApi } from '../api/channelsApi';
import type { ChannelSummary, ValidationError } from '../types/channels';

interface ChannelsContextType {
  // Panel state
  isChannelsPanelOpen: boolean;
  currentChannel: ChannelSummary | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  channels: ChannelSummary[];

  // Actions
  openChannelsPanel: (item: ChannelSummary | null) => void;
  openChannelForEdit: (item: ChannelSummary) => void;
  openChannelForView: (item: ChannelSummary) => void;
  closeChannelsPanel: () => void;

  // 🔹 Singular alias expected by the generic panel resolver (no core changes)
  // Plugin "channels" -> generic looks for closeChannelPanel()
  closeChannelPanel: () => void;

  saveChannel: (_data: any) => Promise<boolean>;
  deleteChannel: (_id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // Loader
  loadChannels: () => Promise<void>;

  // Per-product toggle (used by ProductView)
  setProductEnabled: (args: { productId: string; channel: string; enabled: boolean }) => Promise<{
    ok: boolean;
    row: any;
    summary: ChannelSummary | null;
  }>;
}

const ChannelsContext = createContext<ChannelsContextType | undefined>(undefined);

interface ProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ChannelsProvider({ children, isAuthenticated, onCloseOtherPanels }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel + data
  const [isChannelsPanelOpen, setIsChannelsPanelOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<ChannelSummary | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);

  // Load on auth
  useEffect(() => {
    if (isAuthenticated) {
      loadChannels();
    } else {
      setChannels([]);
    }
  }, [isAuthenticated]);

  // Register panel close with App
  useEffect(() => {
    registerPanelCloseFunction('channels', closeChannelsPanel);
    return () => unregisterPanelCloseFunction('channels');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global submit/cancel (PLURAL) for keyboard/guard integration
  useEffect(() => {
    (window as any).submitChannelsForm = () => {
      const ev = new CustomEvent('submitChannelForm');
      window.dispatchEvent(ev);
    };
    (window as any).cancelChannelsForm = () => {
      const ev = new CustomEvent('cancelChannelForm');
      window.dispatchEvent(ev);
    };
    return () => {
      delete (window as any).submitChannelsForm;
      delete (window as any).cancelChannelsForm;
    };
  }, []);

  const loadChannels = async () => {
    try {
      const items = await channelsApi.getChannels();
      const normalized = (Array.isArray(items) ? items : []).map((it: any) => ({
        ...it,
        lastSyncedAt: it.lastSyncedAt ? new Date(it.lastSyncedAt) : null,
      }));
      setChannels(normalized);
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  // Safe per-product enable/disable for a channel:
  // - Calls backing API
  // - Locally merges returned summary into `channels`
  const setProductEnabled = async (args: {
    productId: string;
    channel: string;
    enabled: boolean;
  }) => {
    const res = await channelsApi.setProductEnabled({
      productId: String(args.productId),
      channel: String(args.channel).toLowerCase(),
      enabled: !!args.enabled,
    });
    const summary: ChannelSummary | null = res?.summary ?? null;

    if (summary) {
      setChannels((prev) => {
        const idx = prev.findIndex(
          (s) => String(s.channel).toLowerCase() === String(summary.channel).toLowerCase(),
        );
        if (idx === -1) {
          return [...prev, summary];
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], ...summary };
        return next;
      });
    }
    return { ok: !!res?.ok, row: res?.row, summary: summary ?? null };
  };

  const openChannelsPanel = (item: ChannelSummary | null) => {
    setCurrentChannel(item);
    setPanelMode(item ? 'view' : 'create');
    setIsChannelsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openChannelForEdit = (item: ChannelSummary) => {
    setCurrentChannel(item);
    setPanelMode('edit');
    setIsChannelsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const openChannelForView = (item: ChannelSummary) => {
    setCurrentChannel(item);
    setPanelMode('view');
    setIsChannelsPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };
  const closeChannelsPanel = () => {
    setIsChannelsPanelOpen(false);
    setCurrentChannel(null);
    setPanelMode('create');
    setValidationErrors([]);
  };
  // Singular alias expected by the generic panel resolver
  const closeChannelPanel = () => closeChannelsPanel();

  // MVP: read-only; no save/delete yet
  const saveChannel = async () => {
    setValidationErrors([{ field: 'general', message: 'Not editable in MVP' }]);
    return false;
  };
  const deleteChannel = async () => {
    setValidationErrors([{ field: 'general', message: 'Delete not supported for channels' }]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const value: ChannelsContextType = useMemo(
    () => ({
      isChannelsPanelOpen,
      currentChannel,
      panelMode,
      validationErrors,
      channels,
      openChannelsPanel,
      openChannelForEdit,
      openChannelForView,
      closeChannelsPanel,
      closeChannelPanel, // singular alias used by the generic panel system
      saveChannel,
      deleteChannel,
      clearValidationErrors,
      loadChannels,
      setProductEnabled,
    }),
    [isChannelsPanelOpen, currentChannel, panelMode, validationErrors, channels],
  );

  return <ChannelsContext.Provider value={value}>{children}</ChannelsContext.Provider>;
}

export function useChannelsContext() {
  const ctx = useContext(ChannelsContext);
  if (!ctx) {
    throw new Error('useChannelsContext must be used within a ChannelsProvider');
  }
  return ctx;
}

// (kept for compatibility if someone imports the hook from this file)
import { useChannelsContext as _useCtx } from '../context/ChannelsContext';
export function useChannels() {
  return _useCtx();
}
