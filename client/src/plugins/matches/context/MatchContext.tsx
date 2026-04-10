import type { LucideIcon } from 'lucide-react';
import React, { createContext, useContext } from 'react';

import type { Match, MatchMention, ValidationError } from '../types/match';

export interface MatchContextType {
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
  mergeIntoMatchSelection: (ids: string[]) => void;
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
    icon: LucideIcon;
    onClick: (item: Match) => void;
    className?: string;
    disabled?: boolean;
  }>;
  showQuickActionDialog: boolean;
  quickActionDialogMessage: string;
  closeQuickActionDialog: () => void;

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

export function useMatchContext() {
  const ctx = useContext(MatchContext);
  if (ctx === undefined) {
    throw new Error('useMatchContext must be used within MatchProvider');
  }
  return ctx;
}

const EMPTY_MATCH_CONTEXT: MatchContextType = {
  isMatchPanelOpen: false,
  currentMatch: null,
  panelMode: 'create',
  validationErrors: [],
  matches: [],
  openMatchPanel: () => {},
  openMatchForEdit: () => {},
  openMatchForView: () => {},
  openMatchSettings: () => {},
  closeMatchSettingsView: () => {},
  closeMatchPanel: () => {},
  matchesContentView: 'list',
  saveMatch: async () => false,
  deleteMatch: async () => {},
  deleteMatches: async () => {},
  clearValidationErrors: () => {},
  selectedMatchIds: [],
  toggleMatchSelected: () => {},
  selectAllMatches: () => {},
  mergeIntoMatchSelection: () => {},
  clearMatchSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  getPanelTitle: () => null,
  getPanelSubtitle: () => null,
  getDeleteMessage: () => '',
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  recentlyDuplicatedMatchId: null,
  setRecentlyDuplicatedMatchId: () => {},
  detailFooterActions: [],
  showQuickActionDialog: false,
  quickActionDialogMessage: '',
  closeQuickActionDialog: () => {},
  displayMentions: [],
  addContactToDraft: () => {},
  removeContactFromDraft: () => {},
  hasQuickEditChanges: false,
  onApplyQuickEdit: async () => {},
  showDiscardQuickEditDialog: false,
  setShowDiscardQuickEditDialog: () => {},
  getCloseHandler: (fn) => fn,
  onDiscardQuickEditAndClose: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function MatchNullProvider({ children }: { children: React.ReactNode }) {
  return <MatchContext.Provider value={EMPTY_MATCH_CONTEXT}>{children}</MatchContext.Provider>;
}

export { MatchContext };
