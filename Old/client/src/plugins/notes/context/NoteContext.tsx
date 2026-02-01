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
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

  // Panel states
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [notes, setNotes] = useState<Note[]>([]);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadNotes();
    } else {
      setNotes([]);
    }
  }, [isAuthenticated]);

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

  const loadNotes = async () => {
    try {
      const notesData = await notesApi.getNotes();

      const transformedNotes = notesData.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));

      setNotes(transformedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

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
        setNotes((prev) =>
          prev.map((note) =>
            note.id === currentNote.id
              ? {
                  ...savedNote,
                  createdAt: new Date(savedNote.createdAt),
                  updatedAt: new Date(savedNote.updatedAt),
                }
              : note,
          ),
        );
        setCurrentNote({
          ...savedNote,
          createdAt: new Date(savedNote.createdAt),
          updatedAt: new Date(savedNote.updatedAt),
        });
        setPanelMode('view');
        setValidationErrors([]);
      } else {
        // Create new note
        savedNote = await notesApi.createNote(noteData);
        setNotes((prev) => [
          ...prev,
          {
            ...savedNote,
            createdAt: new Date(savedNote.createdAt),
            updatedAt: new Date(savedNote.updatedAt),
          },
        ]);
        closeNotePanel();
      }

      return true;
    } catch (error) {
      console.error('Failed to save note:', error);
      setValidationErrors([
        { field: 'general', message: 'Failed to save note. Please try again.' },
      ]);
      return false;
    }
  };

  const deleteNote = async (id: string) => {
    console.log('Deleting note with id:', id);
    try {
      await notesApi.deleteNote(id);
      setNotes((prev) => {
        const newNotes = prev.filter((note) => note.id !== id);
        console.log('Notes after delete:', newNotes);
        return newNotes;
      });
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const duplicateNote = async (originalNote: Note) => {
    try {
      const duplicateData = {
        title: `${originalNote.title} (Copy)`,
        content: originalNote.content,
        mentions: originalNote.mentions || [],
      };

      const newNote = await notesApi.createNote(duplicateData);

      setNotes((prev) => [
        {
          ...newNote,
          createdAt: new Date(newNote.createdAt),
          updatedAt: new Date(newNote.updatedAt),
        },
        ...prev,
      ]);

      console.log('Note duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate note:', error);
      alert('Failed to duplicate note. Please try again.');
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
          <span className="text-xs text-gray-600">
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
