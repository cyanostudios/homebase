// client/src/plugins/profixio/context/ProfixioContext.tsx

import { Trophy } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

import { useApp } from '@/core/api/AppContext';

import { profixioApi } from '../api/profixioApi';
import { mockMatches } from '../mock-data';
import {
  ProfixioMatch,
  ProfixioSeason,
  ProfixioTournament,
  ProfixioSettings,
  ValidationError,
} from '../types/profixio';

interface ProfixioContextType {
  // Panel State
  isProfixioPanelOpen: boolean;
  currentMatch: ProfixioMatch | null;
  panelMode: 'view';
  validationErrors: ValidationError[];

  // Data State
  matches: ProfixioMatch[];
  seasons: ProfixioSeason[];
  tournaments: ProfixioTournament[];
  settings: ProfixioSettings | null;
  loading: boolean;

  // Actions
  openProfixioPanel: (match: ProfixioMatch | null) => void;
  openMatchForView: (match: ProfixioMatch) => void;
  closeProfixioPanel: () => void;
  loadMatches: (filters?: any) => Promise<void>;
  loadSeasons: (organisationId: string, sportId?: string) => Promise<void>;
  loadTournaments: (seasonId: number, categoryId?: number, sportId?: string) => Promise<void>;
  updateSettings: (settings: ProfixioSettings) => Promise<void>;
  clearValidationErrors: () => void;

  // Panel Title helpers
  getPanelTitle: (mode: string, item: ProfixioMatch | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: ProfixioMatch | null) => any;
  getDeleteMessage: (item: ProfixioMatch | null) => string;
}

const ProfixioContext = createContext<ProfixioContextType | undefined>(undefined);

interface ProfixioProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function ProfixioProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: ProfixioProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel states
  const [isProfixioPanelOpen, setIsProfixioPanelOpen] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<ProfixioMatch | null>(null);
  const [panelMode] = useState<'view'>('view');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [matches, setMatches] = useState<ProfixioMatch[]>([]);
  const [seasons, setSeasons] = useState<ProfixioSeason[]>([]);
  const [tournaments, setTournaments] = useState<ProfixioTournament[]>([]);
  const [settings, setSettings] = useState<ProfixioSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Register panel close function
  useEffect(() => {
    registerPanelCloseFunction('profixio', closeProfixioPanel);
    return () => {
      unregisterPanelCloseFunction('profixio');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      const response = await profixioApi.getSettings();
      setSettings(response.settings);
    } catch (error) {
      console.error('Failed to load Profixio settings:', error);
      // Set default settings if API key not configured
      setSettings({
        apiKey: '',
        defaultTeamFilter: 'IFK Malmö',
        defaultSeasonId: null,
        defaultTournamentId: null,
      });
    }
  };

  const loadMatches = async (filters: any = {}) => {
    setLoading(true);
    try {
      // TEMPORARY: Use mock data for prototyping
      // TODO: Remove this and use real API when ready
      setTimeout(() => {
        const teamFilter = filters.teamFilter || settings?.defaultTeamFilter || 'IFK Malmö';

        // Filter mock data by team if filter is provided
        let filteredMatches = mockMatches;
        if (teamFilter && teamFilter.trim()) {
          const filterLower = teamFilter.toLowerCase();
          filteredMatches = mockMatches.filter((match) => {
            const homeTeam = match.homeTeam.name.toLowerCase();
            const awayTeam = match.awayTeam.name.toLowerCase();
            return homeTeam.includes(filterLower) || awayTeam.includes(filterLower);
          });
        }

        setMatches(filteredMatches);
        setLoading(false);
      }, 500); // Simulate API delay

      // REAL API CODE (commented out for now):
      /*
      // Use default filter from settings if not provided
      const teamFilter = filters.teamFilter || settings?.defaultTeamFilter || 'IFK Malmö';
      const seasonId = filters.seasonId || settings?.defaultSeasonId;
      const tournamentId = filters.tournamentId || settings?.defaultTournamentId;

      if (!seasonId && !tournamentId) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const response = await profixioApi.getMatches({
        seasonId,
        tournamentId,
        teamFilter,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        page: filters.page || 1,
        limit: filters.limit || 50,
      });

      setMatches(response.data || []);
      */
    } catch (error: any) {
      console.error('Failed to load matches:', error);
      setValidationErrors([
        {
          field: 'general',
          message:
            error.message || 'Failed to load matches. Please check your API key in settings.',
        },
      ]);
      setMatches([]);
      setLoading(false);
    }
  };

  const loadSeasons = async (organisationId: string, sportId?: string) => {
    try {
      const response = await profixioApi.getSeasons(organisationId, sportId);
      setSeasons(response.data || []);
    } catch (error) {
      console.error('Failed to load seasons:', error);
      setSeasons([]);
    }
  };

  const loadTournaments = async (seasonId: number, categoryId?: number, sportId?: string) => {
    try {
      const response = await profixioApi.getTournaments(seasonId, categoryId, sportId);
      setTournaments(response.data || []);
    } catch (error) {
      console.error('Failed to load tournaments:', error);
      setTournaments([]);
    }
  };

  const updateSettings = async (newSettings: ProfixioSettings) => {
    try {
      const response = await profixioApi.updateSettings(newSettings);
      setSettings(response.settings);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      setValidationErrors([
        {
          field: 'general',
          message: error.message || 'Failed to update settings',
        },
      ]);
      throw error;
    }
  };

  const openProfixioPanel = (match: ProfixioMatch | null) => {
    onCloseOtherPanels();
    setCurrentMatch(match);
    setIsProfixioPanelOpen(true);
  };

  const openMatchForView = (match: ProfixioMatch) => {
    openProfixioPanel(match);
  };

  const closeProfixioPanel = () => {
    setIsProfixioPanelOpen(false);
    setCurrentMatch(null);
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  // Panel Title helpers
  const getPanelTitle = useCallback(
    (mode: string, item: ProfixioMatch | null, isMobileView: boolean) => {
      if (mode === 'view' && item) {
        const homeTeam = item.homeTeam.name;
        const awayTeam = item.awayTeam.name;
        const title = `${homeTeam} vs ${awayTeam}`;

        if (isMobileView && item.date) {
          return (
            <div>
              <div>{title}</div>
              <div className="text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
                {new Date(item.date).toLocaleDateString()}
              </div>
            </div>
          );
        }
        return title;
      }

      return 'Profixio Match';
    },
    [],
  );

  const getPanelSubtitle = useCallback((mode: string, item: ProfixioMatch | null) => {
    if (mode === 'view' && item) {
      const date = item.date ? new Date(item.date).toLocaleDateString() : '';
      const time = item.time ? item.time.substring(0, 5) : '';
      const tournament = item.matchCategory?.name || '';

      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="w-4 h-4" style={{ color: '#2563eb' }} />
          {date && <span className="text-xs text-gray-600 dark:text-gray-400">{date}</span>}
          {time && <span className="text-xs text-gray-600 dark:text-gray-400">• {time}</span>}
          {tournament && (
            <span className="text-xs text-gray-600 dark:text-gray-400">• {tournament}</span>
          )}
        </div>
      );
    }

    return '';
  }, []);

  const getDeleteMessage = (_item: ProfixioMatch | null) => {
    // Read-only plugin - no delete functionality
    return 'Matches cannot be deleted from Profixio plugin';
  };

  const value: ProfixioContextType = {
    isProfixioPanelOpen,
    currentMatch,
    panelMode,
    validationErrors,

    matches,
    seasons,
    tournaments,
    settings,
    loading,

    openProfixioPanel,
    openMatchForView,
    closeProfixioPanel,
    loadMatches,
    loadSeasons,
    loadTournaments,
    updateSettings,
    clearValidationErrors,

    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <ProfixioContext.Provider value={value}>{children}</ProfixioContext.Provider>;
}

export function useProfixio() {
  const context = useContext(ProfixioContext);
  if (context === undefined) {
    throw new Error('useProfixio must be used within a ProfixioProvider');
  }
  return context;
}
