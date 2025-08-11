// client/src/plugins/rail/context/RailContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useApp } from '@/core/api/AppContext';
import { railApi, type RailStation } from '../api/railApi';

type ValidationError = { field: string; message: string };

type Announcement = {
  ActivityType: 'Avgang' | 'Ankomst';
  AdvertisedTimeAtLocation?: string;
  EstimatedTimeAtLocation?: string;
  AdvertisedTrainIdent?: string;
  FromLocation?: Array<{ LocationName: string }>;
  ToLocation?: Array<{ LocationName: string }>;
  TrackAtLocation?: string;
  Deviation?: Array<{ Code?: string; Description?: string }>;
};

interface RailContextType {
  // Panel State (standardiserat för kärnan)
  isRailPanelOpen: boolean;
  currentRail: any | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Data
  stations: RailStation[];
  loadingStations: boolean;
  announcementsByStation: Record<string, Announcement[]>;
  loadingAnnouncements: boolean;

  // Standardiserade actions (krävs av core, no-op i MVP)
  openRailPanel: (item: any | null) => void;
  openRailForEdit: (item: any) => void;
  openRailForView: (item: any) => void;
  closeRailPanel: () => void;
  saveRail: (_: any) => Promise<boolean>;
  deleteRail: (_id: string) => Promise<void>;
  clearValidationErrors: () => void;
  duplicateRail?: (_item: any) => Promise<void>;

  // Rail-specifikt
  refreshStations: (force?: boolean) => Promise<void>;
  loadAnnouncements: (stationCode: string) => Promise<Announcement[]>;
  codeToName: (code?: string) => string;
}

const RailContext = createContext<RailContextType | undefined>(undefined);

interface ProviderProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function RailProvider({ children, isAuthenticated, onCloseOtherPanels }: ProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel state (krav från core)
  const [isRailPanelOpen, setIsRailPanelOpen] = useState(false);
  const [currentRail, setCurrentRail] = useState<any | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Rail data
  const [stations, setStations] = useState<RailStation[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  const [announcementsByStation, setAnnouncementsByStation] = useState<Record<string, Announcement[]>>({});
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // ---- Rail-specifika helpers (MEMOIZED) ----
  const refreshStations = useCallback(async (force = false) => {
    setLoadingStations(true);
    try {
      const res = await railApi.getStations(force);
      const list = Array.isArray((res as any)?.stations) ? (res as any).stations : (Array.isArray(res) ? (res as any) : []);
      setStations(list);
    } finally {
      setLoadingStations(false);
    }
  }, []); // Empty deps - function stable

  const loadAnnouncements = useCallback(async (stationCode: string) => {
    setLoadingAnnouncements(true);
    try {
      const res = await railApi.getAnnouncements(stationCode);
      const data = (res as any)?.announcements ?? [];
      setAnnouncementsByStation((prev) => ({ ...prev, [stationCode]: data }));
      return data;
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  // Panel registration (krav)
  useEffect(() => {
    registerPanelCloseFunction('rails', closeRailPanel);
    return () => unregisterPanelCloseFunction('rails');
  }, []); // Empty deps critical

  // Globala form-funktioner (krav, även om vi inte använder formulär ännu)
  useEffect(() => {
    (window as any).submitRailsForm = () => {
      const evt = new CustomEvent('submitRailForm');
      window.dispatchEvent(evt);
    };
    (window as any).cancelRailsForm = () => {
      const evt = new CustomEvent('cancelRailForm');
      window.dispatchEvent(evt);
    };
    return () => {
      delete (window as any).submitRailsForm;
      delete (window as any).cancelRailsForm;
    };
  }, []);

  // Init data - FIXED: now uses memoized refreshStations
  useEffect(() => {
    if (!isAuthenticated) {
      setStations([]);
      setAnnouncementsByStation({});
      return;
    }
    // hämta stationsindex vid inloggning
    refreshStations().catch(() => {});
  }, [isAuthenticated, refreshStations]); // Now includes refreshStations in deps

  // ---- Actions (core-krav) ----
  const openRailPanel = useCallback((item: any | null) => {
    setCurrentRail(item);
    setPanelMode(item ? 'edit' : 'create');
    setIsRailPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const openRailForEdit = useCallback((item: any) => {
    setCurrentRail(item);
    setPanelMode('edit');
    setIsRailPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const openRailForView = useCallback((item: any) => {
    setCurrentRail(item);
    setPanelMode('view');
    setIsRailPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const closeRailPanel = useCallback(() => {
    setIsRailPanelOpen(false);
    setCurrentRail(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  // MVP: inga CRUD – returnera no-op som uppfyller gränssnittet
  const saveRail = useCallback(async () => {
    setValidationErrors([{ field: 'general', message: 'Save not implemented in Rail MVP' }]);
    return false;
  }, []);

  const deleteRail = useCallback(async () => Promise.resolve(), []);

  const codeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stations) m.set(s.code, s.name);
    return m;
  }, [stations]);

  const codeToName = useCallback((code?: string) => (code ? codeMap.get(code) ?? code : ''), [codeMap]);

  const value: RailContextType = {
    // Panel
    isRailPanelOpen,
    currentRail,
    panelMode,
    validationErrors,

    // Data
    stations,
    loadingStations,
    announcementsByStation,
    loadingAnnouncements,

    // Actions
    openRailPanel,
    openRailForEdit,
    openRailForView,
    closeRailPanel,
    saveRail,
    deleteRail,
    clearValidationErrors,

    // Rail
    refreshStations,
    loadAnnouncements,
    codeToName,
  };

  return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRail() {
  const ctx = useContext(RailContext);
  if (!ctx) throw new Error('useRail must be used within a RailProvider');
  return ctx;
}