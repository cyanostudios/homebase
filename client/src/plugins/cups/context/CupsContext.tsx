import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { resolveSlug } from '@/core/utils/slugUtils';

import { cupsApi } from '../api/cupsApi';
import type { Cup, CupValidationError } from '../types/cups';

type CupsContextType = {
  isCupPanelOpen: boolean;
  currentCup: Cup | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: CupValidationError[];
  cups: Cup[];
  cupsContentView: 'list' | 'settings';
  isSaving: boolean;
  refreshCups: () => Promise<void>;

  openCupPanel: (cup: Cup | null) => void;
  openCupForEdit: (cup: Cup) => void;
  openCupForView: (cup: Cup) => void;
  openCupSettings: () => void;
  closeCupSettingsView: () => void;
  closeCupPanel: () => void;
  saveCup: (data: Partial<Cup> & { name: string }, cupId?: string) => Promise<boolean>;
  deleteCup: (id: string) => Promise<void>;
  deleteCups: (ids: string[]) => Promise<void>;
  importFromIngestSource: (sourceId: string) => Promise<{
    sourceId: string;
    fetched: boolean;
    parsed: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  }>;

  selectedCupIds: string[];
  toggleCupSelected: (id: string) => void;
  selectAllCups: (ids: string[]) => void;
  mergeIntoCupSelection: (ids: string[]) => void;
  clearCupSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  clearValidationErrors: () => void;
  getDeleteMessage: (item: Cup | null) => string;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
};

const CupsContext = createContext<CupsContextType | undefined>(undefined);

export function CupsProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const location = useLocation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/cups');

  const [isCupPanelOpen, setIsCupPanelOpen] = useState(false);
  const [currentCup, setCurrentCup] = useState<Cup | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<CupValidationError[]>([]);
  const [cups, setCups] = useState<Cup[]>([]);
  const [cupsContentView, setCupsContentView] = useState<'list' | 'settings'>('list');
  const [isSaving, setIsSaving] = useState(false);

  const {
    selectedIds: selectedCupIds,
    toggleSelection: toggleCupSelected,
    selectAll: selectAllCups,
    mergeIntoSelection: mergeIntoCupSelection,
    clearSelection: clearCupSelection,
    selectedCount,
    isSelected,
  } = useBulkSelection();

  const loadCups = useCallback(async () => {
    try {
      setCups(await cupsApi.getCups());
    } catch (error: any) {
      setValidationErrors([{ field: 'general', message: error?.message || 'Failed to load cups' }]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCups();
    } else {
      setCups([]);
    }
  }, [isAuthenticated, loadCups]);

  const closeCupPanel = useCallback(() => {
    setIsCupPanelOpen(false);
    setCurrentCup(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('cups', closeCupPanel);
    return () => unregisterPanelCloseFunction('cups');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeCupPanel]);

  const openCupPanel = useCallback(
    (cup: Cup | null) => {
      clearCupSelection();
      setCurrentCup(cup);
      setPanelMode(cup ? 'edit' : 'create');
      setIsCupPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (cup) {
        navigateToItem(cup, cups, 'name');
      }
    },
    [clearCupSelection, navigateToItem, cups, onCloseOtherPanels],
  );

  const openCupForEdit = useCallback(
    (cup: Cup) => {
      setCupsContentView('list');
      setCurrentCup(cup);
      setPanelMode('edit');
      setIsCupPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(cup, cups, 'name');
    },
    [navigateToItem, cups, onCloseOtherPanels],
  );

  const openCupForViewRef = useRef<(cup: Cup) => void>(() => {});
  const openCupForView = useCallback(
    (cup: Cup) => {
      setCupsContentView('list');
      setCurrentCup(cup);
      setPanelMode('view');
      setIsCupPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(cup, cups, 'name');
    },
    [navigateToItem, cups, onCloseOtherPanels],
  );
  useEffect(() => {
    openCupForViewRef.current = openCupForView;
  }, [openCupForView]);

  useEffect(() => {
    if (!cups.length) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'cups') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      return;
    }
    const item = resolveSlug(slug, cups, 'name');
    if (item) {
      openCupForViewRef.current(item as Cup);
    }
  }, [location.pathname, cups]);

  const saveCup = useCallback(
    async (data: Partial<Cup> & { name: string }, cupId?: string): Promise<boolean> => {
      if (!String(data?.name || '').trim()) {
        setValidationErrors([{ field: 'name', message: 'Cup name is required' }]);
        return false;
      }
      setIsSaving(true);
      try {
        setCupsContentView('list');
        if (cupId || currentCup?.id) {
          const id = String(cupId || currentCup?.id);
          const updated = await cupsApi.updateCup(id, data);
          setCups((prev) => prev.map((c) => (c.id === id ? updated : c)));
          setCurrentCup(updated);
          setPanelMode('view');
        } else {
          const created = await cupsApi.createCup(data);
          setCups((prev) => [created, ...prev]);
          setCurrentCup(created);
          setPanelMode('view');
          setIsCupPanelOpen(true);
        }
        setValidationErrors([]);
        return true;
      } catch (error: any) {
        setValidationErrors([
          { field: 'general', message: error?.message || 'Failed to save cup' },
        ]);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentCup],
  );

  const deleteCup = useCallback(
    async (id: string) => {
      await cupsApi.deleteCup(id);
      setCups((prev) => prev.filter((c) => c.id !== id));
      if (currentCup?.id === id) {
        closeCupPanel();
      }
    },
    [currentCup, closeCupPanel],
  );

  const deleteCups = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (!uniqueIds.length) {
        return;
      }
      await bulkApi.bulkDelete('cups', uniqueIds);
      const idSet = new Set(uniqueIds);
      setCups((prev) => prev.filter((c) => !idSet.has(c.id)));
      if (currentCup?.id && idSet.has(String(currentCup.id))) {
        closeCupPanel();
      }
      clearCupSelection();
    },
    [clearCupSelection, closeCupPanel, currentCup],
  );

  const importFromIngestSource = useCallback(
    async (sourceId: string) => {
      const result = await cupsApi.importFromIngestSource(sourceId);
      await loadCups();
      return result;
    },
    [loadCups],
  );

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const getDeleteMessage = useCallback(
    (item: Cup | null) => `Delete "${item?.name || 'this cup'}"? This action cannot be undone.`,
    [],
  );

  const openCupSettings = useCallback(() => {
    clearCupSelection();
    setCupsContentView('settings');
    onCloseOtherPanels();
  }, [clearCupSelection, onCloseOtherPanels]);

  const closeCupSettingsView = useCallback(() => {
    setCupsContentView('list');
  }, []);

  const rawItemIndex = currentCup ? cups.findIndex((c) => c.id === currentCup.id) : -1;
  const totalItems = cups.length;
  const hasPrevItem = rawItemIndex > 0;
  const hasNextItem = rawItemIndex >= 0 && rawItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || rawItemIndex <= 0) {
      return;
    }
    const prev = cups[rawItemIndex - 1];
    if (prev) {
      openCupForView(prev);
    }
  }, [hasPrevItem, rawItemIndex, cups, openCupForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || rawItemIndex < 0 || rawItemIndex >= cups.length - 1) {
      return;
    }
    const next = cups[rawItemIndex + 1];
    if (next) {
      openCupForView(next);
    }
  }, [hasNextItem, rawItemIndex, cups, openCupForView]);

  const value: CupsContextType = {
    isCupPanelOpen,
    currentCup,
    panelMode,
    validationErrors,
    cups,
    cupsContentView,
    isSaving,
    refreshCups: loadCups,
    openCupPanel,
    openCupForEdit,
    openCupForView,
    openCupSettings,
    closeCupSettingsView,
    closeCupPanel,
    saveCup,
    deleteCup,
    deleteCups,
    importFromIngestSource,
    selectedCupIds,
    toggleCupSelected,
    selectAllCups,
    mergeIntoCupSelection,
    clearCupSelection,
    selectedCount,
    isSelected,
    clearValidationErrors,
    getDeleteMessage,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: rawItemIndex === -1 ? 0 : rawItemIndex + 1,
    totalItems,
  };

  return <CupsContext.Provider value={value}>{children}</CupsContext.Provider>;
}

export function useCupsContext() {
  const context = useContext(CupsContext);
  if (!context) {
    throw new Error('useCupsContext must be used within CupsProvider');
  }
  return context;
}
