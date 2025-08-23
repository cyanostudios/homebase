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
  saveChannel: (_data: any) => Promise<boolean>;
  deleteChannel: (_id: string) => Promise<void>;
  clearValidationErrors: () => void;

  // Loader
  loadChannels: () => Promise<void>;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // MVP: read-only; no save/delete yet
  const saveChannel = async () => {
    setValidationErrors([{ field: 'general', message: 'Not editable in MVP' }]);
    return false;
  };
  const deleteChannel = async () => {
    setValidationErrors([{ field: 'general', message: 'Delete not supported for channels' }]);
  };

  const clearValidationErrors = () => setValidationErrors([]);

  const value: ChannelsContextType = useMemo(() => ({
    isChannelsPanelOpen,
    currentChannel,
    panelMode,
    validationErrors,
    channels,
    openChannelsPanel,
    openChannelForEdit,
    openChannelForView,
    closeChannelsPanel,
    saveChannel,
    deleteChannel,
    clearValidationErrors,
    loadChannels,
  }), [isChannelsPanelOpen, currentChannel, panelMode, validationErrors, channels]);

  return <ChannelsContext.Provider value={value}>{children}</ChannelsContext.Provider>;
}

export function useChannelsContext() {
  const ctx = useContext(ChannelsContext);
  if (!ctx) throw new Error('useChannelsContext must be used within a ChannelsProvider');
  return ctx;
}
