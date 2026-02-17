import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';

import { matchesApi } from '../api/matchesApi';
import { Match, ValidationError, getFormatsForSport } from '../types/match';

interface MatchContextType {
  isMatchPanelOpen: boolean;
  currentMatch: Match | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  matches: Match[];

  openMatchPanel: (match: Match | null) => void;
  openMatchForEdit: (match: Match) => void;
  openMatchForView: (match: Match) => void;
  openMatchSettings: () => void;
  closeMatchPanel: () => void;
  saveMatch: (data: any, matchId?: string) => Promise<boolean>;
  deleteMatch: (id: string) => Promise<void>;
  deleteMatches: (ids: string[]) => Promise<void>;
  clearValidationErrors: () => void;

  selectedMatchIds: string[];
  toggleMatchSelected: (id: string) => void;
  selectAllMatches: (ids: string[]) => void;
  clearMatchSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  getPanelTitle: (mode: string, item: Match | null) => React.ReactNode;
  getPanelSubtitle: (mode: string, item: Match | null) => React.ReactNode;
  getDeleteMessage: (item: Match | null) => string;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

interface MatchProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function MatchProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: MatchProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  const [isMatchPanelOpen, setIsMatchPanelOpen] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const {
    selectedIds: selectedMatchIds,
    toggleSelection: toggleMatchSelectedCore,
    selectAll: selectAllMatchesCore,
    clearSelection: clearMatchSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeMatchPanel = useCallback(() => {
    setIsMatchPanelOpen(false);
    setCurrentMatch(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

  useEffect(() => {
    registerPanelCloseFunction('matches', closeMatchPanel);
    return () => unregisterPanelCloseFunction('matches');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeMatchPanel]);

  const loadMatches = useCallback(async () => {
    try {
      const data = await matchesApi.getMatches();
      setMatches(data);
    } catch (error: any) {
      console.error('Failed to load matches:', error);
      const msg = error?.message || error?.error || 'Failed to load matches';
      setValidationErrors([{ field: 'general', message: msg }]);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMatches();
    } else {
      setMatches([]);
    }
  }, [isAuthenticated, loadMatches]);

  const validateMatch = useCallback((data: any): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!(data.home_team ?? '').trim()) {
      errors.push({ field: 'home_team', message: 'Home team is required' });
    }
    if (!(data.away_team ?? '').trim()) {
      errors.push({ field: 'away_team', message: 'Away team is required' });
    }
    if (!data.start_time) {
      errors.push({ field: 'start_time', message: 'Time is required' });
    }
    const sport = (data.sport_type ?? 'football') as 'football' | 'handball';
    const allowedFormats = getFormatsForSport(sport);
    if (!(data.format ?? '').trim() || !allowedFormats.includes(data.format)) {
      errors.push({ field: 'format', message: `Select format for ${sport}` });
    }
    return errors;
  }, []);

  const openMatchPanel = useCallback(
    (match: Match | null) => {
      clearMatchSelectionCore();
      setCurrentMatch(match);
      setPanelMode(match ? 'edit' : 'create');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels, clearMatchSelectionCore],
  );

  const openMatchForEdit = useCallback(
    (match: Match) => {
      clearMatchSelectionCore();
      setCurrentMatch(match);
      setPanelMode('edit');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels, clearMatchSelectionCore],
  );

  const openMatchForView = useCallback(
    (match: Match) => {
      setCurrentMatch(match);
      setPanelMode('view');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openMatchSettings = useCallback(() => {
    clearMatchSelectionCore();
    setCurrentMatch(null);
    setPanelMode('settings');
    setIsMatchPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearMatchSelectionCore]);

  const clearValidationErrors = useCallback(() => setValidationErrors([]), []);

  const saveMatch = useCallback(
    async (data: any, matchId?: string): Promise<boolean> => {
      const errors = validateMatch(data);
      setValidationErrors(errors);
      if (errors.length > 0) {
        return false;
      }

      try {
        if (matchId ?? currentMatch?.id) {
          const id = matchId ?? currentMatch!.id;
          const saved = await matchesApi.updateMatch(id, data);
          setMatches((prev) => prev.map((m) => (m.id === id ? saved : m)));
          setCurrentMatch(saved);
          setPanelMode('view');
        } else {
          const saved = await matchesApi.createMatch(data);
          setMatches((prev) => [saved, ...prev]);
          closeMatchPanel();
        }
        setValidationErrors([]);
        return true;
      } catch (error: any) {
        const msg = error?.message || error?.error || 'Failed to save match';
        setValidationErrors([{ field: 'general', message: msg }]);
        return false;
      }
    },
    [currentMatch, validateMatch, closeMatchPanel],
  );

  const deleteMatch = useCallback(
    async (id: string) => {
      try {
        await matchesApi.deleteMatch(id);
        setMatches((prev) => prev.filter((m) => m.id !== id));
        if (currentMatch?.id === id) {
          closeMatchPanel();
        }
      } catch (error: any) {
        const msg = error?.message || error?.error || 'Failed to delete match';
        alert(msg);
      }
    },
    [currentMatch, closeMatchPanel],
  );

  const deleteMatches = useCallback(
    async (ids: string[]) => {
      const unique = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (unique.length === 0) {
        return;
      }
      try {
        await bulkApi.bulkDelete('matches', unique);
        setMatches((prev) => prev.filter((m) => !unique.includes(m.id)));
        if (currentMatch && unique.includes(currentMatch.id)) {
          closeMatchPanel();
        }
        clearMatchSelectionCore();
      } catch (error: any) {
        const msg = error?.message || error?.error || 'Failed to delete matches';
        alert(msg);
      }
    },
    [currentMatch, closeMatchPanel, clearMatchSelectionCore],
  );

  const getPanelTitle = useCallback((mode: string, item: Match | null) => {
    if (mode === 'view' && item) {
      return `${item.home_team} – ${item.away_team}`;
    }
    if (mode === 'edit') {
      return 'Edit match';
    }
    if (mode === 'create') {
      return 'New match';
    }
    if (mode === 'settings') {
      return 'Settings – Matches';
    }
    return 'Match';
  }, []);

  const getPanelSubtitle = useCallback((mode: string, item: Match | null) => {
    if (mode === 'view' && item) {
      const d = item.start_time ? new Date(item.start_time) : null;
      return (
        <span className="text-xs text-muted-foreground">
          {item.home_team} – {item.away_team}
          {d ? ` · ${d.toLocaleString('sv-SE')}` : ''}
        </span>
      );
    }
    if (mode === 'edit') {
      return 'Edit match details';
    }
    if (mode === 'create') {
      return 'Add a new match';
    }
    return '';
  }, []);

  const getDeleteMessage = useCallback((item: Match | null) => {
    if (!item) {
      return 'Are you sure you want to delete this match?';
    }
    return `Are you sure you want to delete the match ${item.home_team} – ${item.away_team}?`;
  }, []);

  const value: MatchContextType = {
    isMatchPanelOpen,
    currentMatch,
    panelMode,
    validationErrors,
    matches,
    openMatchPanel,
    openMatchForEdit,
    openMatchForView,
    openMatchSettings,
    closeMatchPanel,
    saveMatch,
    deleteMatch,
    deleteMatches,
    clearValidationErrors,
    selectedMatchIds,
    toggleMatchSelected: toggleMatchSelectedCore,
    selectAllMatches: selectAllMatchesCore,
    clearMatchSelection: clearMatchSelectionCore,
    selectedCount,
    isSelected,
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

export function useMatchContext() {
  const ctx = useContext(MatchContext);
  if (ctx === undefined) {
    throw new Error('useMatchContext must be used within MatchProvider');
  }
  return ctx;
}
