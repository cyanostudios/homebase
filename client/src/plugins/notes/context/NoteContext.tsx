import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Note, ValidationError } from '../types/notes';
import { notesApi } from '../api/notesApi';

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
  clearValidationErrors: () => void;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

interface NoteProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function NoteProvider({ children, isAuthenticated, onCloseOtherPanels }: NoteProviderProps) {
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

  const loadNotes = async () => {
    try {
      const notesData = await notesApi.getNotes();
      
      // Transform API data to match interface
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
        message: 'Note title is required'
      });
    }
    
    if (!noteData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Note content is required'
      });
    }
    
    return errors;
  };

  // Note functions
  const openNotePanel = (note: Note | null) => {
    setCurrentNote(note);
    setPanelMode(note ? 'edit' : 'create');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels(); // Close other plugin panels
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
    
    // Run validation
    const errors = validateNote(noteData);
    setValidationErrors(errors);
    
    // If there are blocking errors, don't save
    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      console.log('Validation failed:', blockingErrors);
      return false;
    }
    
    try {
      let savedNote: Note;
      
      if (currentNote) {
        // Update existing note
        savedNote = await notesApi.updateNote(currentNote.id, noteData);
        setNotes(prev => prev.map(note => 
          note.id === currentNote.id ? {
            ...savedNote,
            createdAt: new Date(savedNote.createdAt),
            updatedAt: new Date(savedNote.updatedAt),
          } : note
        ));
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
        setNotes(prev => [...prev, {
          ...savedNote,
          createdAt: new Date(savedNote.createdAt),
          updatedAt: new Date(savedNote.updatedAt),
        }]);
        closeNotePanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save note:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save note. Please try again.' }]);
      return false;
    }
  };

  const deleteNote = async (id: string) => {
    console.log("Deleting note with id:", id);
    try {
      await notesApi.deleteNote(id);
      setNotes(prev => {
        const newNotes = prev.filter(note => note.id !== id);
        console.log("Notes after delete:", newNotes);
        return newNotes;
      });
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
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
    clearValidationErrors,
  };

  return (
    <NoteContext.Provider value={value}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNoteContext() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNoteContext must be used within a NoteProvider');
  }
  return context;
}