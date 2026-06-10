import React, { createContext, useContext } from 'react';

import type { TeamPayload } from '../api/teamsApi';
import type { Team, TeamValidationError } from '../types/teams';

export type TeamsContextType = {
  isTeamPanelOpen: boolean;
  currentTeam: Team | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: TeamValidationError[];
  teams: Team[];
  teamsContentView: 'list' | 'settings';
  isSaving: boolean;
  refreshTeams: () => Promise<void>;

  openTeamPanel: (team: Team | null) => void;
  openTeamForEdit: (team: Team) => void;
  openTeamForView: (team: Team) => void;
  openTeamSettings: () => void;
  closeTeamSettingsView: () => void;
  closeTeamPanel: () => void;
  saveTeam: (data: TeamPayload, teamId?: string) => Promise<boolean>;
  deleteTeam: (id: string) => Promise<void>;
  deleteTeams: (ids: string[]) => Promise<void>;

  selectedTeamIds: string[];
  toggleTeamSelected: (id: string) => void;
  selectAllTeams: (ids: string[]) => void;
  mergeIntoTeamSelection: (ids: string[]) => void;
  clearTeamSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;

  clearValidationErrors: () => void;
  getDeleteMessage: (item: Team | null) => string;

  getDuplicateConfig: (
    item: Team | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
  executeDuplicate: (
    item: Team,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  recentlyDuplicatedTeamId: string | null;
  setRecentlyDuplicatedTeamId: (id: string | null) => void;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
};

export const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export function useTeamsContext() {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeamsContext must be used within TeamProvider');
  }
  return context;
}

const EMPTY_TEAMS_CONTEXT: TeamsContextType = {
  isTeamPanelOpen: false,
  currentTeam: null,
  panelMode: 'create',
  validationErrors: [],
  teams: [],
  teamsContentView: 'list',
  isSaving: false,
  refreshTeams: async () => {},
  openTeamPanel: () => {},
  openTeamForEdit: () => {},
  openTeamForView: () => {},
  openTeamSettings: () => {},
  closeTeamSettingsView: () => {},
  closeTeamPanel: () => {},
  saveTeam: async () => false,
  deleteTeam: async () => {},
  deleteTeams: async () => {},
  selectedTeamIds: [],
  toggleTeamSelected: () => {},
  selectAllTeams: () => {},
  mergeIntoTeamSelection: () => {},
  clearTeamSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  clearValidationErrors: () => {},
  getDeleteMessage: () => '',
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedTeamId: null,
  setRecentlyDuplicatedTeamId: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function TeamsNullProvider({ children }: { children: React.ReactNode }) {
  return <TeamsContext.Provider value={EMPTY_TEAMS_CONTEXT}>{children}</TeamsContext.Provider>;
}
