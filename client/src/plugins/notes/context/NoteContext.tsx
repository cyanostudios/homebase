import { StickyNote } from 'lucide-react';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { useApp } from '@/core/api/AppContext';

import { notesApi } from '../api/notesApi';
import { Note, ValidationError } from '../types/notes';

interface NoteContextType {
  // Note Panel State
  isNotePanelOpen: boolean;
  currentNote: Note | null;
  panelMode: 'create' | 'edit' | 'view';
  validationErrors: ValidationError[];

  // Notes Data
  notes: Note[];

  // Note Actions
  openNotePanel: (note: Note | null) => void;
  openNoteForEdit: (note: Note) => void;
  openNoteForView: (note: Note) => void;
  closeNotePanel: () => void;
  saveNote: (noteData: any) => Promise<boolean>;
  deleteNote: (id: string) => Promise<void>;
  duplicateNote: (note: Note) => Promise<void>;
  clearValidationErrors: () => void;

  // NEW: Panel Title Functions
  getPanelTitle: (mode: string, item: Note | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Note | null) => any;
  getDeleteMessage: (item: Note | null) => string;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

interface NoteProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function NoteProvider({ children, isAuthenticated, onCloseOtherPanels }: NoteProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, notes, refreshData } = useApp();

  // Panel states
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Panel registration
  useEffect(() => {
    registerPanelCloseFunction('notes', closeNotePanel);
    return () => {
      unregisterPanelCloseFunction('notes');
    };
  }, []);

  // Global functions for form submission
  useEffect(() => {
    window.submitNotesForm = () => {
      const event = new CustomEvent('submitNoteForm');
      window.dispatchEvent(event);
    };

    window.cancelNotesForm = () => {
      const event = new CustomEvent('cancelNoteForm');
      window.dispatchEvent(event);
    };

    return () => {
      delete window.submitNotesForm;
      delete window.cancelNotesForm;
    };
  }, []);

  const validateNote = (noteData: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!noteData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Note title is required',
      });
    }

    if (!noteData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Note content is required',
      });
    }

    return errors;
  };

  const openNotePanel = (note: Note | null) => {
    setCurrentNote(note);
    setPanelMode(note ? 'edit' : 'create');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openNoteForEdit = (note: Note) => {
    setCurrentNote(note);
    setPanelMode('edit');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openNoteForView = (note: Note) => {
    setCurrentNote(note);
    setPanelMode('view');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeNotePanel = () => {
    setIsNotePanelOpen(false);
    setCurrentNote(null);
    setPanelMode('create');
    setValidationErrors([]);
  };

  const clearValidationErrors = () => {
    setValidationErrors([]);
  };

  const saveNote = async (noteData: any): Promise<boolean> => {
    console.log('Validating note data:', noteData);

    const errors = validateNote(noteData);
    setValidationErrors(errors);

    const blockingErrors = errors.filter((error) => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }

    try {
      let savedNote: Note;

      if (currentNote) {
        // Update existing note
        savedNote = await notesApi.updateNote(currentNote.id, noteData);
        setCurrentNote({
          ...savedNote,
          createdAt: new Date(savedNote.createdAt),
          updatedAt: new Date(savedNote.updatedAt),
        });
        setPanelMode('view');
        setValidationErrors([]);
        await refreshData();
      } else {
        // Create new note
        savedNote = await notesApi.createNote(noteData);
        closeNotePanel();
        await refreshData();
      }

      return true;
    } catch (error: any) {
      console.error('Failed to save note:', error);
      
      // V2: Handle standardized error format from backend
      const validationErrors: ValidationError[] = [];
      
      // Check if backend returned validation errors in details array
      if (error?.details && Array.isArray(error.details)) {
        error.details.forEach((detail: any) => {
          if (typeof detail === 'string') {
            validationErrors.push({ field: 'general', message: detail });
          } else if (detail?.field && detail?.message) {
            validationErrors.push({ field: detail.field, message: detail.message });
          } else if (detail?.msg) {
            validationErrors.push({ field: detail.param || 'general', message: detail.msg });
          }
        });
      }
      
      // If no validation errors from backend, use error message
      if (validationErrors.length === 0) {
        const errorMessage = error?.message || error?.error || 'Failed to save note. Please try again.';
        validationErrors.push({ field: 'general', message: errorMessage });
      }
      
      setValidationErrors(validationErrors);
      return false;
    }
  };

  const deleteNote = async (id: string) => {
    console.log('Deleting note with id:', id);
    try {
      await notesApi.deleteNote(id);
      await refreshData();
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to delete note';
      alert(errorMessage);
    }
  };

  const duplicateNote = async (originalNote: Note) => {
    try {
      const duplicateData = {
        title: `${originalNote.title} (Copy)`,
        content: originalNote.content,
        mentions: originalNote.mentions || [],
      };

      await notesApi.createNote(duplicateData);
      await refreshData();
      console.log('Note duplicated successfully');
    } catch (error: any) {
      console.error('Failed to duplicate note:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to duplicate note. Please try again.';
      alert(errorMessage);
    }
  };

  // NEW: Panel Title Functions (moved from PanelTitles.tsx)
  const getPanelTitle = (mode: string, item: Note | null, isMobileView: boolean) => {
    // View mode with item
    if (mode === 'view' && item) {
      return item.title || `Note #${item.id}`;
    }

    // Non-view modes (create/edit)
    switch (mode) {
      case 'edit':
        return 'Edit Note';
      case 'create':
        return 'Create Note';
      default:
        return 'Note';
    }
  };

  const getPanelSubtitle = (mode: string, item: Note | null) => {
    // View mode with item
    if (mode === 'view' && item) {
      return (
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4" style={{ color: '#ca8a04' }} />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Created {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      );
    }

    // Non-view modes
    switch (mode) {
      case 'edit':
        return 'Update note information';
      case 'create':
        return 'Enter new note details';
      default:
        return '';
    }
  };

  const getDeleteMessage = (item: Note | null) => {
    if (!item) {
      return 'Are you sure you want to delete this note?';
    }

    const itemName = item.title || 'this note';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  const value: NoteContextType = {
    // Panel State
    isNotePanelOpen,
    currentNote,
    panelMode,
    validationErrors,

    // Data State
    notes,

    // Actions
    openNotePanel,
    openNoteForEdit,
    openNoteForView,
    closeNotePanel,
    saveNote,
    deleteNote,
    duplicateNote,
    clearValidationErrors,

    // NEW: Panel Title Functions
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,
  };

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
}

export function useNoteContext() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNoteContext must be used within a NoteProvider');
  }
  return context;
}
