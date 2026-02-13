import { CheckSquare, Download, StickyNote } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { usePluginActions } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { cn } from '@/lib/utils';

import { notesApi } from '../api/notesApi';
import { Note, ValidationError } from '../types/notes';

interface NoteContextType {
  // Note Panel State
  isNotePanelOpen: boolean;
  currentNote: Note | null;
  panelMode: 'create' | 'edit' | 'view' | 'settings';
  validationErrors: ValidationError[];

  // Notes Data
  notes: Note[];

  // Note Actions
  openNotePanel: (note: Note | null) => void;
  openNoteForEdit: (note: Note) => void;
  openNoteForView: (note: Note) => void;
  openNoteSettings: () => void;
  closeNotePanel: () => void;
  saveNote: (noteData: any) => Promise<boolean>;
  createNote: (noteData: { title: string; content?: string; mentions?: any[] }) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  deleteNotes: (ids: string[]) => Promise<void>;
  duplicateNote: (note: Note) => Promise<void>;
  clearValidationErrors: () => void;
  // Bulk selection
  selectedNoteIds: string[];
  toggleNoteSelected: (id: string) => void;
  selectAllNotes: (ids: string[]) => void;
  clearNoteSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  importNotes: (data: any[]) => Promise<void>;

  // NEW: Panel Title Functions
  getPanelTitle: (mode: string, item: Note | null, isMobileView: boolean) => any;
  getPanelSubtitle: (mode: string, item: Note | null) => any;
  getDeleteMessage: (item: Note | null) => string;
  /** ID of note just duplicated; list highlights it until next action. */
  recentlyDuplicatedNoteId: string | null;
  setRecentlyDuplicatedNoteId: (id: string | null) => void;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

interface NoteProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function NoteProvider({ children, isAuthenticated, onCloseOtherPanels }: NoteProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction, refreshData } = useApp();
  const pluginActions = usePluginActions('note');

  // Panel states
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [notes, setNotes] = useState<Note[]>([]);
  const [recentlyDuplicatedNoteId, setRecentlyDuplicatedNoteId] = useState<string | null>(null);

  // Use core bulk selection hook
  const {
    selectedIds: selectedNoteIds,
    toggleSelection: toggleNoteSelectedCore,
    selectAll: selectAllNotesCore,
    clearSelection: clearNoteSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  // Define closeNotePanel BEFORE useEffect that uses it (TDZ fix)
  const closeNotePanel = useCallback(() => {
    setIsNotePanelOpen(false);
    setCurrentNote(null);
    setPanelMode('create');
    setValidationErrors([]);
  }, []);

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
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeNotePanel]);

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

  const loadNotes = useCallback(async () => {
    try {
      const notesData = await notesApi.getNotes();

      const transformedNotes = notesData.map((note: any) => ({
        ...note,
        createdAt: new Date(note.createdAt),
        updatedAt: new Date(note.updatedAt),
      }));

      setNotes(transformedNotes);
    } catch (error: any) {
      console.error('Failed to load notes:', error);
      // V2: Handle standardized error format
      const errorMessage = error?.message || error?.error || 'Failed to load notes';
      setValidationErrors([{ field: 'general', message: errorMessage }]);
    }
  }, []);

  const validateNote = useCallback((noteData: any): ValidationError[] => {
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
  }, []);

  const openNotePanel = useCallback(
    (note: Note | null) => {
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode(note ? 'edit' : 'create');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openNoteForEdit = useCallback(
    (note: Note) => {
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode('edit');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openNoteForView = useCallback(
    (note: Note) => {
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode('view');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
    },
    [onCloseOtherPanels],
  );

  const openNoteSettings = useCallback(() => {
    setCurrentNote(null);
    setPanelMode('settings');
    setIsNotePanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  }, [onCloseOtherPanels]);

  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  const saveNote = useCallback(
    async (noteData: any): Promise<boolean> => {
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
          const errorMessage =
            error?.message || error?.error || 'Failed to save note. Please try again.';
          validationErrors.push({ field: 'general', message: errorMessage });
        }

        setValidationErrors(validationErrors);
        return false;
      }
    },
    [currentNote, closeNotePanel, validateNote],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      console.log('Deleting note with id:', id);
      try {
        await notesApi.deleteNote(id);
        setNotes((prev) => {
          const newNotes = prev.filter((note) => note.id !== id);
          console.log('Notes after delete:', newNotes);
          return newNotes;
        });
        // Remove from selection if selected
        if (isSelected(id)) {
          toggleNoteSelectedCore(id);
        }
      } catch (error: any) {
        console.error('Failed to delete note:', error);
        // V2: Handle standardized error format
        const errorMessage = error?.message || error?.error || 'Failed to delete note';
        alert(errorMessage);
      }
    },
    [isSelected, toggleNoteSelectedCore],
  );

  // Bulk delete using core bulkApi
  const deleteNotes = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set((ids || []).map(String))).filter(Boolean);
      if (!uniqueIds.length) {
        return;
      }

      try {
        await bulkApi.bulkDelete('notes', uniqueIds);
        setNotes((prev) => prev.filter((note) => !uniqueIds.includes(String(note.id))));
        clearNoteSelectionCore();
      } catch (error: any) {
        console.error('Bulk delete failed:', error);
        const errorMessage = error?.message || error?.error || 'Failed to delete notes';
        setValidationErrors([{ field: 'general', message: errorMessage }]);
      }
    },
    [clearNoteSelectionCore],
  );

  // Selection helpers - wrap core hook functions for backward compatibility
  const toggleNoteSelected = useCallback(
    (id: string) => {
      toggleNoteSelectedCore(id);
    },
    [toggleNoteSelectedCore],
  );

  const selectAllNotes = useCallback(
    (ids: string[]) => {
      selectAllNotesCore(ids);
    },
    [selectAllNotesCore],
  );

  const clearNoteSelection = useCallback(() => {
    clearNoteSelectionCore();
  }, [clearNoteSelectionCore]);

  const duplicateNote = useCallback(async (originalNote: Note) => {
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
    } catch (error: any) {
      console.error('Failed to duplicate note:', error);
      // V2: Handle standardized error format
      const errorMessage =
        error?.message || error?.error || 'Failed to duplicate note. Please try again.';
      alert(errorMessage);
    }
  }, []);

  const createNote = useCallback(
    async (noteData: { title: string; content?: string; mentions?: any[] }): Promise<Note> => {
      const newNote = await notesApi.createNote(noteData);
      const noteWithDates = {
        ...newNote,
        createdAt: new Date(newNote.createdAt),
        updatedAt: new Date(newNote.updatedAt),
      };
      setNotes((prev) => [noteWithDates, ...prev]);
      return noteWithDates;
    },
    [],
  );

  const exportNote = useCallback((note: Note) => {
    const content = `${note.title}\n\n${note.content}\n\nCreated: ${new Date(note.createdAt).toLocaleDateString()}`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, []);

  const convertToTask = useCallback(
    async (note: Note) => {
      // Find the specific action for task conversion if it exists in pluginActions
      const taskAction = pluginActions.find((a) => a.id === 'create-task-from-note');
      if (taskAction) {
        await taskAction.onClick(note);
      } else {
        alert('Task plugin is not available.');
      }
    },
    [pluginActions],
  );

  // NEW: Panel Title Functions (moved from PanelTitles.tsx)
  const getPanelTitle = (mode: string, item: Note | null, _isMobileView: boolean) => {
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
      case 'settings':
        return 'Notes Settings';
      default:
        return 'Note';
    }
  };

  const getPanelSubtitle = (mode: string, item: Note | null) => {
    // View mode with item
    if (mode === 'view' && item) {
      return (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={() => exportNote(item)}
              className="h-7 text-[10px] px-2 shrink-0"
            >
              Export
            </Button>

            {/* Render dynamic plugin actions (e.g. "To Task") */}
            {pluginActions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant || 'secondary'}
                size="sm"
                icon={action.icon}
                onClick={() => action.onClick(item)}
                className={cn('h-7 text-[10px] px-2 shrink-0', action.className)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    // Non-view modes
    switch (mode) {
      case 'edit':
        return 'Update note information';
      case 'create':
        return 'Enter new note details';
      case 'settings':
        return 'Configure plugin preferences';
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
    openNoteSettings,
    closeNotePanel,
    saveNote,
    createNote,
    deleteNote,
    deleteNotes,
    duplicateNote,
    clearValidationErrors,
    // Bulk selection
    selectedNoteIds,
    toggleNoteSelected,
    selectAllNotes,
    clearNoteSelection,
    selectedCount,
    isSelected,
    importNotes: async (data: any[]) => {
      let successCount = 0;
      for (const item of data) {
        try {
          await notesApi.createNote(item);
          successCount++;
        } catch (error) {
          console.error('Failed to import note', item, error);
        }
      }
      if (successCount > 0) {
        await loadNotes();
      }
    },

    // NEW: Panel Title Functions
    getPanelTitle,
    getPanelSubtitle,
    getDeleteMessage,

    recentlyDuplicatedNoteId,
    setRecentlyDuplicatedNoteId,
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
