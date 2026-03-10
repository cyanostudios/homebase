import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

import { usePluginActions } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { resolveSlug } from '@/core/utils/slugUtils';

import { matchesApi } from '../api/matchesApi';
import { Match, MatchMention, ValidationError, getFormatsForSport } from '../types/match';

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
  closeMatchSettingsView: () => void;
  closeMatchPanel: () => void;
  matchesContentView: 'list' | 'settings';
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

  getDuplicateConfig: (
    item: Match | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: Match,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedMatchId: string | null;
  setRecentlyDuplicatedMatchId: (id: string | null) => void;

  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Match) => void;
    className?: string;
  }>;

  // Quick-edit in view mode (contacts/mentions): draft until "Update" is clicked (same UX as slots/task)
  displayMentions: MatchMention[];
  addContactToDraft: (contact: { id: number | string; companyName?: string }) => void;
  removeContactFromDraft: (contactId: string) => void;
  hasQuickEditChanges: boolean;
  onApplyQuickEdit: () => Promise<void>;
  showDiscardQuickEditDialog: boolean;
  setShowDiscardQuickEditDialog: (show: boolean) => void;
  getCloseHandler: (defaultClose: () => void) => () => void;
  onDiscardQuickEditAndClose: () => void;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
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
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    openToSlotDialog,
    registerMatchesNavigation,
    user,
  } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/matches');
  const pluginActions = usePluginActions('match');
  const hasSlotsPlugin = Boolean(user?.plugins?.includes('slots'));

  const [isMatchPanelOpen, setIsMatchPanelOpen] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesContentView, setMatchesContentView] = useState<'list' | 'settings'>('list');
  const [recentlyDuplicatedMatchId, setRecentlyDuplicatedMatchId] = useState<string | null>(null);
  const [mentionsDraft, setMentionsDraft] = useState<MatchMention[] | null>(null);
  const [showDiscardQuickEditDialog, setShowDiscardQuickEditDialog] = useState(false);
  const pendingCloseRef = useRef<(() => void) | null>(null);

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
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
    navigateToBase();
  }, [navigateToBase]);

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

  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || matches.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'matches' || !parts[2]) {
      return;
    }
    const item = resolveSlug(
      parts[2],
      matches,
      (i: any) => `${i.home_team ?? ''}-vs-${i.away_team ?? ''}`,
    );
    if (item) {
      didOpenFromUrlRef.current = true;
      openMatchForViewRef.current(item as Match);
    }
  }, [matches]);

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
      setRecentlyDuplicatedMatchId(null);
      setCurrentMatch(match);
      setPanelMode(match ? 'edit' : 'create');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (match) {
        navigateToItem(match, matches, (i: any) => `${i.home_team ?? ''}-vs-${i.away_team ?? ''}`);
      }
    },
    [onCloseOtherPanels, clearMatchSelectionCore, navigateToItem, matches],
  );

  const openMatchForEdit = useCallback(
    (match: Match) => {
      clearMatchSelectionCore();
      setRecentlyDuplicatedMatchId(null);
      setCurrentMatch(match);
      setPanelMode('edit');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(match, matches, (i: any) => `${i.home_team ?? ''}-vs-${i.away_team ?? ''}`);
    },
    [onCloseOtherPanels, clearMatchSelectionCore, navigateToItem, matches],
  );

  const openMatchForView = useCallback(
    (match: Match) => {
      setRecentlyDuplicatedMatchId(null);
      setCurrentMatch(match);
      setPanelMode('view');
      setIsMatchPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(match, matches, (i: any) => `${i.home_team ?? ''}-vs-${i.away_team ?? ''}`);
    },
    [onCloseOtherPanels, navigateToItem, matches],
  );

  const openMatchForViewRef = useRef(openMatchForView);
  useEffect(() => {
    openMatchForViewRef.current = openMatchForView;
  }, [openMatchForView]);
  const openMatchForViewBridge = useCallback((match: Match) => {
    openMatchForViewRef.current(match);
  }, []);

  useEffect(() => {
    registerMatchesNavigation(openMatchForViewBridge);
    return () => registerMatchesNavigation(null);
  }, [registerMatchesNavigation, openMatchForViewBridge]);

  const currentItemIndex = currentMatch ? matches.findIndex((m) => m.id === currentMatch.id) : -1;
  const totalItems = matches.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = matches[currentItemIndex - 1];
    if (prev) {
      openMatchForView(prev);
    }
  }, [hasPrevItem, currentItemIndex, matches, openMatchForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= matches.length - 1) {
      return;
    }
    const next = matches[currentItemIndex + 1];
    if (next) {
      openMatchForView(next);
    }
  }, [hasNextItem, currentItemIndex, matches, openMatchForView]);

  useEffect(() => {
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, [currentMatch?.id]);

  const displayMentions =
    currentMatch && mentionsDraft !== null
      ? mentionsDraft
      : Array.isArray(currentMatch?.mentions)
        ? currentMatch.mentions
        : [];

  const addContactToDraft = useCallback(
    (contact: { id: number | string; companyName?: string }) => {
      const id = String(contact.id);
      const name = contact.companyName ?? 'Contact';
      setMentionsDraft((prev) => {
        const base = prev ?? (Array.isArray(currentMatch?.mentions) ? currentMatch.mentions : []);
        if (base.some((m) => String(m.contactId) === id)) {
          return prev;
        }
        return [...base, { contactId: id, contactName: name, companyName: contact.companyName }];
      });
    },
    [currentMatch?.mentions],
  );

  const removeContactFromDraft = useCallback(
    (contactId: string) => {
      const id = String(contactId);
      setMentionsDraft((prev) => {
        if (prev === null) {
          const base = Array.isArray(currentMatch?.mentions) ? currentMatch.mentions : [];
          return base.filter((m) => String(m.contactId) !== id);
        }
        return prev.filter((m) => String(m.contactId) !== id);
      });
    },
    [currentMatch?.mentions],
  );

  const hasQuickEditChanges = Boolean(
    currentMatch &&
      panelMode === 'view' &&
      (() => {
        const saved = Array.isArray(currentMatch.mentions) ? currentMatch.mentions : [];
        const draft = mentionsDraft ?? saved;
        if (draft.length !== saved.length) {
          return true;
        }
        const savedIds = [...saved].map((m) => String(m.contactId)).sort();
        const draftIds = [...draft].map((m) => String(m.contactId)).sort();
        return savedIds.some((id, i) => draftIds[i] !== id);
      })(),
  );

  const openMatchSettings = useCallback(() => {
    clearMatchSelectionCore();
    setRecentlyDuplicatedMatchId(null);
    setMatchesContentView('settings');
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearMatchSelectionCore]);

  const closeMatchSettingsView = useCallback(() => {
    setMatchesContentView('list');
  }, []);

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

  const onApplyQuickEdit = useCallback(async () => {
    if (!currentMatch) {
      return;
    }
    const nextMentions =
      mentionsDraft ?? (Array.isArray(currentMatch.mentions) ? currentMatch.mentions : []);
    const payload = {
      home_team: currentMatch.home_team,
      away_team: currentMatch.away_team,
      location: currentMatch.location,
      start_time: currentMatch.start_time,
      sport_type: currentMatch.sport_type,
      format: currentMatch.format,
      total_minutes: currentMatch.total_minutes,
      contact_id: nextMentions[0]?.contactId ?? null,
      mentions: nextMentions,
    };
    const success = await saveMatch(payload, currentMatch.id);
    if (success) {
      setMentionsDraft(null);
    }
  }, [currentMatch, mentionsDraft, saveMatch]);

  const getCloseHandler = useCallback(
    (defaultClose: () => void) => {
      return () => {
        if (hasQuickEditChanges) {
          pendingCloseRef.current = defaultClose;
          setShowDiscardQuickEditDialog(true);
        } else {
          defaultClose();
        }
      };
    },
    [hasQuickEditChanges],
  );

  const onDiscardQuickEditAndClose = useCallback(() => {
    setMentionsDraft(null);
    setShowDiscardQuickEditDialog(false);
  }, []);

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

  const getDuplicateConfig = useCallback((item: Match | null) => {
    if (!item) {
      return null;
    }
    return { defaultName: '', nameLabel: '', confirmOnly: true };
  }, []);

  const executeDuplicate = useCallback(
    async (
      item: Match,
      _newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const copy = {
        home_team: item.home_team,
        away_team: item.away_team,
        location: item.location ?? '',
        start_time: item.start_time,
        sport_type: item.sport_type,
        format: item.format,
        total_minutes: item.total_minutes,
      };
      const newMatch = await matchesApi.createMatch(copy);
      setMatches((prev) => [newMatch, ...prev]);
      const highlightId =
        newMatch?.id !== null && newMatch?.id !== undefined ? String(newMatch.id) : undefined;
      return { closePanel: closeMatchPanel, highlightId };
    },
    [closeMatchPanel],
  );

  const detailFooterActions = pluginActions
    .filter((action) => action.id !== 'create-slot-from-match' || hasSlotsPlugin)
    .map((action) => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      onClick:
        action.id === 'create-slot-from-match' && openToSlotDialog
          ? (match: Match) => openToSlotDialog(match)
          : (action.onClick as (match: Match) => void),
      className:
        action.id === 'create-slot-from-match'
          ? 'h-9 text-xs px-3 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30'
          : 'h-9 text-xs px-3',
    }));

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
    closeMatchSettingsView,
    closeMatchPanel,
    matchesContentView,
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
    getDuplicateConfig,
    executeDuplicate,
    recentlyDuplicatedMatchId,
    setRecentlyDuplicatedMatchId,
    detailFooterActions,
    displayMentions,
    addContactToDraft,
    removeContactFromDraft,
    hasQuickEditChanges,
    onApplyQuickEdit,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    getCloseHandler,
    onDiscardQuickEditAndClose,

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
    totalItems,
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
