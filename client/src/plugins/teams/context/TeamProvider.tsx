import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { usePluginDuplicate } from '@/core/hooks/usePluginDuplicate';
import { usePluginNavigation } from '@/core/hooks/usePluginNavigation';
import { usePluginValidation } from '@/core/hooks/usePluginValidation';
import { resolveSlug } from '@/core/utils/slugUtils';

import { teamsApi } from '../api/teamsApi';
import type { TeamPayload } from '../api/teamsApi';
import type { Team, TeamValidationError } from '../types/teams';

import { TeamsContext } from './TeamContext';
import type { TeamsContextType } from './TeamContext';

export function TeamProvider({
  children,
  isAuthenticated,
  onCloseOtherPanels,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  const { navigateToItem, navigateToBase } = useItemUrl('/teams');

  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const { validationErrors, setValidationErrors, clearValidationErrors } =
    usePluginValidation<TeamValidationError>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsContentView, setTeamsContentView] = useState<'list' | 'settings'>('list');
  const [isSaving, setIsSaving] = useState(false);
  const [recentlyDuplicatedTeamId, setRecentlyDuplicatedTeamId] = useState<string | null>(null);

  const {
    selectedIds: selectedTeamIds,
    toggleSelection: toggleTeamSelected,
    selectAll: selectAllTeams,
    mergeIntoSelection: mergeIntoTeamSelection,
    clearSelection: clearTeamSelection,
    selectedCount,
    isSelected,
  } = useBulkSelection();

  const loadTeams = useCallback(async () => {
    try {
      setTeams(await teamsApi.getTeams());
    } catch (error: any) {
      setValidationErrors([
        { field: 'general', message: error?.message || 'Failed to load teams' },
      ]);
    }
  }, [setValidationErrors]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTeams();
    } else {
      setTeams([]);
    }
  }, [isAuthenticated, loadTeams]);

  const closeTeamPanel = useCallback(() => {
    setIsTeamPanelOpen(false);
    setCurrentTeam(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase, setValidationErrors]);

  useEffect(() => {
    registerPanelCloseFunction('teams', closeTeamPanel);
    return () => unregisterPanelCloseFunction('teams');
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeTeamPanel]);

  const openTeamPanel = useCallback(
    (team: Team | null) => {
      clearTeamSelection();
      setCurrentTeam(team);
      setPanelMode(team ? 'edit' : 'create');
      setIsTeamPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (team) {
        navigateToItem(team, teams, 'name');
      }
    },
    [clearTeamSelection, navigateToItem, teams, onCloseOtherPanels, setValidationErrors],
  );

  const openTeamForEdit = useCallback(
    (team: Team) => {
      setTeamsContentView('list');
      setCurrentTeam(team);
      setPanelMode('edit');
      setIsTeamPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(team, teams, 'name');
    },
    [navigateToItem, teams, onCloseOtherPanels, setValidationErrors],
  );

  const openTeamForViewRef = useRef<(team: Team) => void>(() => {});
  const openTeamForView = useCallback(
    (team: Team) => {
      setTeamsContentView('list');
      setCurrentTeam(team);
      setPanelMode('view');
      setIsTeamPanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(team, teams, 'name');
    },
    [navigateToItem, teams, onCloseOtherPanels, setValidationErrors],
  );
  useEffect(() => {
    openTeamForViewRef.current = openTeamForView;
  }, [openTeamForView]);

  useEffect(() => {
    if (!teams.length) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'teams') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      return;
    }
    const item = resolveSlug(slug, teams, 'name');
    if (item) {
      openTeamForViewRef.current(item as Team);
    }
  }, [location.pathname, teams]);

  const saveTeam = useCallback(
    async (data: TeamPayload, teamId?: string): Promise<boolean> => {
      if (!String(data?.name || '').trim()) {
        setValidationErrors([{ field: 'name', message: 'Team name is required' }]);
        return false;
      }
      setIsSaving(true);
      try {
        setTeamsContentView('list');
        if (teamId || currentTeam?.id) {
          const id = String(teamId || currentTeam?.id);
          const updated = await teamsApi.updateTeam(id, data);
          setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)));
          setCurrentTeam(updated);
          setPanelMode('view');
        } else {
          const created = await teamsApi.createTeam(data);
          setTeams((prev) => [created, ...prev]);
          setCurrentTeam(created);
          setPanelMode('view');
          setIsTeamPanelOpen(true);
        }
        setValidationErrors([]);
        return true;
      } catch (error: any) {
        setValidationErrors([
          { field: 'general', message: error?.message || 'Failed to save team' },
        ]);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [currentTeam, setValidationErrors],
  );

  const deleteTeam = useCallback(
    async (id: string) => {
      await teamsApi.deleteTeam(id);
      setTeams((prev) => prev.filter((t) => t.id !== id));
      if (currentTeam?.id === id) {
        closeTeamPanel();
      }
    },
    [currentTeam, closeTeamPanel],
  );

  const deleteTeams = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));
      if (!uniqueIds.length) {
        return;
      }
      await bulkApi.bulkDelete('teams', uniqueIds);
      const idSet = new Set(uniqueIds);
      setTeams((prev) => prev.filter((t) => !idSet.has(t.id)));
      if (currentTeam?.id && idSet.has(String(currentTeam.id))) {
        closeTeamPanel();
      }
      clearTeamSelection();
    },
    [clearTeamSelection, closeTeamPanel, currentTeam],
  );

  const getDeleteMessage = useCallback(
    (item: Team | null) => `Delete "${item?.name || 'this team'}"? This action cannot be undone.`,
    [],
  );

  const createTeamDuplicate = useCallback(async (item: Team, newName: string): Promise<Team> => {
    const payload: TeamPayload = {
      name: (newName ?? '').trim() || item.name?.trim() || 'Untitled',
      age_group: item.age_group,
      gender: item.gender,
      player_count: item.player_count,
      series_team_count: item.series_team_count,
      series_teams: item.series_teams,
      status: item.status,
      status_note: item.status_note,
      team_notes: item.team_notes,
      training_times: item.training_times,
      season_breaks: item.season_breaks,
      responsibles: item.responsibles,
      color: item.color,
    };
    const created = await teamsApi.createTeam(payload);
    setTeams((prev) => [created, ...prev]);
    return created;
  }, []);

  const { getDuplicateConfig, executeDuplicate } = usePluginDuplicate({
    getDefaultName: (item: Team) => `Copy of ${item.name?.trim() || t('nav.teams')}`,
    nameLabel: t('teams.form.nameLabel'),
    confirmOnly: false,
    createDuplicate: createTeamDuplicate,
    closePanel: closeTeamPanel,
  });

  const openTeamSettings = useCallback(() => {
    clearTeamSelection();
    setTeamsContentView('settings');
    onCloseOtherPanels();
  }, [clearTeamSelection, onCloseOtherPanels]);

  const closeTeamSettingsView = useCallback(() => {
    setTeamsContentView('list');
  }, []);

  const teamsOrderedByName = useMemo(
    () =>
      [...teams].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    [teams],
  );

  const {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  } = usePluginNavigation(teamsOrderedByName, currentTeam, openTeamForView);

  const value: TeamsContextType = {
    isTeamPanelOpen,
    currentTeam,
    panelMode,
    validationErrors,
    teams,
    teamsContentView,
    isSaving,
    refreshTeams: loadTeams,
    openTeamPanel,
    openTeamForEdit,
    openTeamForView,
    openTeamSettings,
    closeTeamSettingsView,
    closeTeamPanel,
    saveTeam,
    deleteTeam,
    deleteTeams,
    selectedTeamIds,
    toggleTeamSelected,
    selectAllTeams,
    mergeIntoTeamSelection,
    clearTeamSelection,
    selectedCount,
    isSelected,
    clearValidationErrors,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    recentlyDuplicatedTeamId,
    setRecentlyDuplicatedTeamId,
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex,
    totalItems,
  };

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}
