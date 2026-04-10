import React, { createContext, useContext } from 'react';

import type { ExportFormat } from '@/core/utils/exportUtils';

import type { Note, NoteShare, ValidationError } from '../types/notes';

export interface NoteContextType {
  isNotePanelOpen: boolean;
  currentNote: Note | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];
  notes: Note[];
  openNotePanel: (note: Note | null) => void;
  openNoteForEdit: (note: Note) => void;
  openNoteForView: (note: Note) => void;
  openNoteSettings: () => void;
  closeNoteSettingsView: () => void;
  closeNotePanel: () => void;
  notesContentView: 'list' | 'settings';
  saveNote: (noteData: any) => Promise<boolean>;
  createNote: (noteData: { title: string; content?: string; mentions?: any[] }) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  deleteNotes: (ids: string[]) => Promise<void>;
  getDuplicateConfig: (
    item: Note | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly: boolean } | null;
  executeDuplicate: (
    item: Note,
    newName: string,
  ) => Promise<{ closePanel: () => void; highlightId?: string }>;
  clearValidationErrors: () => void;
  selectedNoteIds: string[];
  toggleNoteSelected: (id: string) => void;
  selectAllNotes: (ids: string[]) => void;
  mergeIntoNoteSelection: (ids: string[]) => void;
  clearNoteSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  importNotes: (data: any[]) => Promise<void>;
  getDeleteMessage: (item: Note | null) => string;
  recentlyDuplicatedNoteId: string | null;
  setRecentlyDuplicatedNoteId: (id: string | null) => void;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: Note) => void;
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
    disabled?: boolean;
  }>;
  noteShareExistingShare: NoteShare | null;
  noteShareShowDialog: boolean;
  setNoteShareShowDialog: (show: boolean) => void;
  noteShareIsCreatingShare: boolean;
  handleNoteCopyShareUrl: () => void;
  handleNoteRevokeShare: () => void;
  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export function useNoteContext() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNoteContext must be used within a NoteProvider');
  }
  return context;
}

const EMPTY_NOTE_CONTEXT: NoteContextType = {
  isNotePanelOpen: false,
  currentNote: null,
  panelMode: 'create',
  validationErrors: [],
  notes: [],
  openNotePanel: () => {},
  openNoteForEdit: () => {},
  openNoteForView: () => {},
  openNoteSettings: () => {},
  closeNoteSettingsView: () => {},
  closeNotePanel: () => {},
  notesContentView: 'list',
  saveNote: async () => false,
  createNote: async () => ({}) as Note,
  deleteNote: async () => {},
  deleteNotes: async () => {},
  getDuplicateConfig: () => null,
  executeDuplicate: async () => ({ closePanel: () => {} }),
  clearValidationErrors: () => {},
  selectedNoteIds: [],
  toggleNoteSelected: () => {},
  selectAllNotes: () => {},
  mergeIntoNoteSelection: () => {},
  clearNoteSelection: () => {},
  selectedCount: 0,
  isSelected: () => false,
  importNotes: async () => {},
  getDeleteMessage: () => '',
  recentlyDuplicatedNoteId: null,
  setRecentlyDuplicatedNoteId: () => {},
  exportFormats: [],
  onExportItem: () => {},
  detailFooterActions: [],
  noteShareExistingShare: null,
  noteShareShowDialog: false,
  setNoteShareShowDialog: () => {},
  noteShareIsCreatingShare: false,
  handleNoteCopyShareUrl: () => {},
  handleNoteRevokeShare: () => {},
  navigateToPrevItem: () => {},
  navigateToNextItem: () => {},
  hasPrevItem: false,
  hasNextItem: false,
  currentItemIndex: 0,
  totalItems: 0,
};

export function NoteNullProvider({ children }: { children: React.ReactNode }) {
  return <NoteContext.Provider value={EMPTY_NOTE_CONTEXT}>{children}</NoteContext.Provider>;
}

export { NoteContext };
