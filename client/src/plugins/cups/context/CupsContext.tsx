import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';

import { cupsApi } from '../api/cupsApi';
import { Cup, CupSource } from '../types/cup';

interface CupsContextType {
  isCupPanelOpen: boolean;
  currentCup: Cup | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';

  cups: Cup[];
  sources: CupSource[];

  openCupPanel: (cup: Cup | null) => void;
  openCupForEdit: (cup: Cup) => void;
  openCupForView: (cup: Cup) => void;
  openCupSettings: () => void;
  closeCupPanel: () => void;
  closeCupSettingsView: () => void;
  cupsContentView: 'list' | 'settings';

  saveCup: (data: Partial<Cup>) => Promise<boolean>;
  deleteCup: (id: string) => Promise<void>;

  fetchSources: () => Promise<void>;
  createSource: (data: { type: 'url' | 'file'; url?: string; label?: string }) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  scrapeSource: (id: string) => Promise<{ inserted: number }>;
  scrapeFile: (id: string, file: File) => Promise<{ inserted: number }>;

  selectedCupIds: string[];
  toggleCupSelected: (id: string) => void;
  selectAllCups: (ids: string[]) => void;
  clearCupSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  getDeleteMessage: (item: Cup | null) => string;
  getPanelTitle: () => string;
  recentlyDuplicatedCupId: string | null;
  setRecentlyDuplicatedCupId: (id: string | null) => void;
  scrapingSourceId: string | null;
}

const CupsContext = createContext<CupsContextType | null>(null);

export function CupsProvider({
  children,
  isAuthenticated: _isAuthenticated,
  onCloseOtherPanels: _onCloseOtherPanels,
}: {
  children: ReactNode;
  isAuthenticated?: boolean;
  onCloseOtherPanels?: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [cups, setCups] = useState<Cup[]>([]);
  const [sources, setSources] = useState<CupSource[]>([]);
  const [currentCup, setCurrentCup] = useState<Cup | null>(null);
  const [isCupPanelOpen, setIsCupPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('view');
  const [cupsContentView, setCupsContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedCupId, setRecentlyDuplicatedCupId] = useState<string | null>(null);
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null);

  const { navigateToBase } = useItemUrl('/cups');
  const {
    selectedIds: selectedCupIds,
    toggleSelection: toggleCupSelected,
    selectAll: selectAllCups,
    clearSelection: clearCupSelection,
    selectedCount,
    isSelected,
  } = useBulkSelection();

  // ─── Fetch cups ────────────────────────────────────────────────────────────
  const fetchCups = useCallback(async () => {
    try {
      const data = await cupsApi.getCups();
      setCups(data);
    } catch (err) {
      console.error('Failed to fetch cups', err);
    }
  }, []);

  useEffect(() => {
    fetchCups();
  }, [fetchCups]);

  // ─── Deep-link: open cup from URL ──────────────────────────────────────────
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) {
      return;
    }
    const m = location.pathname.match(/\/cups\/(\d+)/);
    if (m) {
      const id = m[1];
      cupsApi
        .getCup(id)
        .then((cup) => {
          setCurrentCup(cup);
          setPanelMode('view');
          setIsCupPanelOpen(true);
        })
        .catch(() => {});
    }
    initialLoadDone.current = true;
  }, [location.pathname]);

  // ─── Panel close registration ─────────────────────────────────────────────
  const closeCupPanel = useCallback(() => {
    setIsCupPanelOpen(false);
    setCurrentCup(null);
    setPanelMode('create');
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('cups', closeCupPanel);
    return () => unregisterPanelCloseFunction('cups');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeCupPanel]);

  // ─── Navigation helpers ───────────────────────────────────────────────────
  const openCupPanel = useCallback((cup: Cup | null) => {
    setCurrentCup(cup);
    setPanelMode(cup ? 'view' : 'create');
    setIsCupPanelOpen(true);
  }, []);

  const openCupForEdit = useCallback((cup: Cup) => {
    setCurrentCup(cup);
    setPanelMode('edit');
    setIsCupPanelOpen(true);
  }, []);

  const openCupForView = useCallback((cup: Cup) => {
    setCurrentCup(cup);
    setPanelMode('view');
    setIsCupPanelOpen(true);
  }, []);

  const openCupSettings = useCallback(() => {
    setCupsContentView('settings');
    setIsCupPanelOpen(false);
  }, []);

  const closeCupSettingsView = useCallback(() => {
    setCupsContentView('list');
  }, []);

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  const saveCup = useCallback(
    async (data: Partial<Cup>): Promise<boolean> => {
      try {
        if (currentCup) {
          const updated = await cupsApi.updateCup(currentCup.id, data);
          setCups((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setCurrentCup(updated);
        } else {
          const created = await cupsApi.createCup(data);
          setCups((prev) => [created, ...prev]);
          setCurrentCup(created);
          setPanelMode('view');
        }
        return true;
      } catch (err) {
        console.error('Failed to save cup', err);
        return false;
      }
    },
    [currentCup],
  );

  const deleteCup = useCallback(
    async (id: string) => {
      try {
        await cupsApi.deleteCup(id);
        setCups((prev) => prev.filter((c) => c.id !== id));
        if (currentCup?.id === id) {
          setCurrentCup(null);
          setIsCupPanelOpen(false);
        }
      } catch (err) {
        console.error('Failed to delete cup', err);
      }
    },
    [currentCup],
  );

  // ─── Sources ──────────────────────────────────────────────────────────────
  const fetchSources = useCallback(async () => {
    try {
      const data = await cupsApi.getSources();
      setSources(data);
    } catch (err) {
      console.error('Failed to fetch cup sources', err);
    }
  }, []);

  const createSource = useCallback(
    async (data: { type: 'url' | 'file'; url?: string; label?: string }) => {
      const source = await cupsApi.createSource(data);
      setSources((prev) => [...prev, source]);
    },
    [],
  );

  const deleteSource = useCallback(async (id: string) => {
    await cupsApi.deleteSource(id);
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const scrapeSource = useCallback(
    async (id: string) => {
      setScrapingSourceId(id);
      try {
        const result = await cupsApi.scrapeSource(id);
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  last_scraped_at: new Date().toISOString(),
                  last_result: `${result.inserted} cups found`,
                }
              : s,
          ),
        );
        await fetchCups();
        return { inserted: result.inserted };
      } finally {
        setScrapingSourceId(null);
      }
    },
    [fetchCups],
  );

  const scrapeFile = useCallback(
    async (id: string, file: File) => {
      setScrapingSourceId(id);
      try {
        const result = await cupsApi.scrapeFile(id, file);
        setSources((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  last_scraped_at: new Date().toISOString(),
                  last_result: `${result.inserted} cups from file`,
                }
              : s,
          ),
        );
        await fetchCups();
        return { inserted: result.inserted };
      } finally {
        setScrapingSourceId(null);
      }
    },
    [fetchCups],
  );

  // ─── UI helpers ───────────────────────────────────────────────────────────
  const getDeleteMessage = useCallback(
    (item: Cup | null) =>
      item ? t('cups.deleteMessage', { name: item.name }) : t('cups.deletePrompt'),
    [t],
  );

  const getPanelTitle = useCallback(() => {
    if (panelMode === 'create') {
      return t('cups.newCup');
    }
    if (panelMode === 'edit') {
      return currentCup?.name ?? t('cups.editCup');
    }
    return currentCup?.name ?? t('cups.cup');
  }, [panelMode, currentCup, t]);

  return (
    <CupsContext.Provider
      value={{
        isCupPanelOpen,
        currentCup,
        panelMode,
        cups,
        sources,
        openCupPanel,
        openCupForEdit,
        openCupForView,
        openCupSettings,
        closeCupPanel,
        closeCupSettingsView,
        cupsContentView,
        saveCup,
        deleteCup,
        fetchSources,
        createSource,
        deleteSource,
        scrapeSource,
        scrapeFile,
        selectedCupIds,
        toggleCupSelected,
        selectAllCups,
        clearCupSelection,
        selectedCount,
        isSelected,
        getDeleteMessage,
        getPanelTitle,
        recentlyDuplicatedCupId,
        setRecentlyDuplicatedCupId,
        scrapingSourceId,
      }}
    >
      {children}
    </CupsContext.Provider>
  );
}

export function useCups(): CupsContextType {
  const ctx = useContext(CupsContext);
  if (!ctx) {
    throw new Error('useCups must be used inside CupsProvider');
  }
  return ctx;
}
