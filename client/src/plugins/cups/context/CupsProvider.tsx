import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { resolveSlug } from '@/core/utils/slugUtils';

import { cupsApi } from '../api/cupsApi';
import type { Cup, CupValidationError } from '../types/cups';

import { CupsContext } from './CupsContext';
import type { CupsContextType } from './CupsContext';

/** Prev/next i detaljpanel följer stigande id (2 → 3), inte listans visningsordning. */
function compareCupIdForNav(a: string, b: string): number {
  const sa = String(a);
  const sb = String(b);
  if (/^\d+$/.test(sa) && /^\d+$/.test(sb)) {
    const ba = BigInt(sa);
    const bb = BigInt(sb);
    if (ba < bb) {
      return -1;
    }
    if (ba > bb) {
      return 1;
    }
    return 0;
  }
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

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
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<CupValidationError>();
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
  }, [setValidationErrors]);

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
  }, [navigateToBase, setValidationErrors]);

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
    [clearCupSelection, navigateToItem, cups, onCloseOtherPanels, setValidationErrors],
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
    [navigateToItem, cups, onCloseOtherPanels, setValidationErrors],
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
    [navigateToItem, cups, onCloseOtherPanels, setValidationErrors],
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
    [currentCup, setValidationErrors],
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

  const restoreCup = useCallback(
    async (id: string) => {
      const restored = await cupsApi.restoreCup(id);
      setCups((prev) => prev.map((c) => (c.id === id ? restored : c)));
      if (currentCup?.id === id) {
        setCurrentCup(restored);
      }
    },
    [currentCup],
  );

  const importFromIngestSource = useCallback(
    async (sourceId: string) => {
      const result = await cupsApi.importFromIngestSource(sourceId);
      await loadCups();
      return result;
    },
    [loadCups],
  );

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

  const cupsOrderedById = useMemo(
    () => [...cups].sort((x, y) => compareCupIdForNav(String(x.id), String(y.id))),
    [cups],
  );

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(cupsOrderedById, currentCup, openCupForView);

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
    restoreCup,
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
    currentItemIndex,
    totalItems,
  };

  return <CupsContext.Provider value={value}>{children}</CupsContext.Provider>;
}
