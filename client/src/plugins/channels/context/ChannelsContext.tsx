import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';
import {
  getAppCurrentPage,
  isEcommerceCatalogBootstrapPage,
  subscribeAppCurrentPage,
} from '@/core/navigation/appCurrentPageStore';

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

  // Per-product toggle (used when toggling product channel enable)
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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, user } = useApp();
  const activePage = useSyncExternalStore(
    subscribeAppCurrentPage,
    getAppCurrentPage,
    getAppCurrentPage,
  );
  const shouldBootstrap =
    isAuthenticated &&
    !!user?.plugins?.includes('channels') &&
    isEcommerceCatalogBootstrapPage(activePage);

  // Panel + data
  const [isChannelsPanelOpen, setIsChannelsPanelOpen] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<ChannelSummary | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const loadChannels = useCallback(async () => {
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
  }, []);

  // Load when catalog bootstrap applies
  useEffect(() => {
    if (shouldBootstrap) {
      loadChannels();
    } else if (!isAuthenticated) {
      setChannels([]);
    }
  }, [isAuthenticated, shouldBootstrap, loadChannels]);

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

  // Safe per-product enable/disable for a channel:
  // - Calls backing API
  // - Locally merges returned summary into `channels`
  const setProductEnabled = useCallback(
    async (args: {
      productId: string;
      channel: string;
      enabled: boolean;
      channelInstanceId?: number;
    }) => {
      const res = await channelsApi.setProductEnabled({
        productId: String(args.productId),
        channel: String(args.channel).toLowerCase(),
        enabled: !!args.enabled,
        channelInstanceId: args.channelInstanceId,
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
    },
    [],
  );

  const openChannelsPanel = useCallback(
    (item: ChannelSummary | null) => {
      setCurrentChannel(item);
      setPanelMode(item ? 'view' : 'create');
      setIsChannelsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openChannelForEdit = useCallback(
    (item: ChannelSummary) => {
      setCurrentChannel(item);
      setPanelMode('edit');
      setIsChannelsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openChannelForView = useCallback(
    (item: ChannelSummary) => {
      setCurrentChannel(item);
      setPanelMode('view');
      setIsChannelsPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const closeChannelsPanel = useCallback(() => {
    setIsChannelsPanelOpen(false);
    setCurrentChannel(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);
  // Singular alias expected by the generic panel resolver
  const closeChannelPanel = useCallback(() => closeChannelsPanel(), [closeChannelsPanel]);

  // MVP: read-only; no save/delete yet
  const saveChannel = useCallback(async () => {
    setValidationErrors([{ field: 'general', message: 'Not editable in MVP' }]);
    return false;
  }, []);
  const deleteChannel = useCallback(async () => {
    setValidationErrors([{ field: 'general', message: 'Delete not supported for channels' }]);
  }, []);

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
    [
      isChannelsPanelOpen,
      currentChannel,
      panelMode,
      validationErrors,
      channels,
      openChannelsPanel,
      openChannelForEdit,
      openChannelForView,
      closeChannelsPanel,
      closeChannelPanel,
      saveChannel,
      deleteChannel,
      clearValidationErrors,
      loadChannels,
      setProductEnabled,
    ],
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
