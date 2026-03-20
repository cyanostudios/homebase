import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import { usePluginActions } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { resolveSlug } from '@/core/utils/slugUtils';

import { notesApi } from '../api/notesApi';
import { Note, ValidationError } from '../types/notes';
import { getNoteExportBaseFilename, notesExportConfig } from '../utils/noteExportConfig';

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
  closeNoteSettingsView: () => void;
  closeNotePanel: () => void;
  /** When 'settings', main content shows NotesSettingsView instead of list. */
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
  // Bulk selection
  selectedNoteIds: string[];
  toggleNoteSelected: (id: string) => void;
  selectAllNotes: (ids: string[]) => void;
  clearNoteSelection: () => void;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  importNotes: (data: any[]) => Promise<void>;

  getDeleteMessage: (item: Note | null) => string;
  /** ID of note just duplicated; list highlights it until next action. */
  recentlyDuplicatedNoteId: string | null;
  setRecentlyDuplicatedNoteId: (id: string | null) => void;
  /** Formats offered in detail footer (e.g. ['txt', 'csv', 'pdf']). */
  exportFormats: ExportFormat[];
  /** Called by PanelFooter to export current item in given format. */
  onExportItem: (format: ExportFormat, item: Note) => void;
  /** Optional actions shown in detail panel footer (e.g. "To Task") – same style as Delete/Export. */
  detailFooterActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Note) => void;
    className?: string;
  }>;

  navigateToPrevItem: () => void;
  navigateToNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  currentItemIndex: number;
  totalItems: number;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

interface NoteProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function NoteProvider({ children, isAuthenticated, onCloseOtherPanels }: NoteProviderProps) {
  const { t } = useTranslation();
  const {
    registerPanelCloseFunction,
    unregisterPanelCloseFunction,
    registerNotesNavigation,
    openToTaskDialog,
    user,
  } = useApp();
  const pluginActions = usePluginActions('note');
  const hasTasksPlugin = Boolean(user?.plugins?.includes('tasks'));
  const { navigateToItem, navigateToBase } = useItemUrl('/notes');

  // Panel states
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view' | 'settings'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Data state
  const [notes, setNotes] = useState<Note[]>([]);
  const [recentlyDuplicatedNoteId, setRecentlyDuplicatedNoteId] = useState<string | null>(null);

  // Content view: list (default) or settings (full-page settings like Core Settings)
  const [notesContentView, setNotesContentView] = useState<'list' | 'settings'>('list');

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
    navigateToBase();
  }, [navigateToBase]);

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

  // Load data when authenticated (after loadNotes is defined)
  useEffect(() => {
    if (isAuthenticated) {
      loadNotes();
    } else {
      setNotes([]);
    }
  }, [isAuthenticated, loadNotes]);

  // Initial deep-link: if the page loaded at /notes/:slug, open that note once data arrives
  const didOpenFromUrlRef = useRef(false);
  useEffect(() => {
    if (didOpenFromUrlRef.current || notes.length === 0) {
      return;
    }
    const parts = window.location.pathname.split('/');
    if (parts[1] !== 'notes' || !parts[2]) {
      return;
    }
    const item = resolveSlug(parts[2], notes, 'title');
    if (item) {
      didOpenFromUrlRef.current = true;
      openNoteForViewRef.current(item as Note);
    }
  }, [notes]);

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
      clearNoteSelectionCore();
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode(note ? 'edit' : 'create');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      if (note) {
        navigateToItem(note, notes, 'title');
      }
    },
    [onCloseOtherPanels, clearNoteSelectionCore, navigateToItem, notes],
  );

  const openNoteForEdit = useCallback(
    (note: Note) => {
      clearNoteSelectionCore();
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode('edit');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(note, notes, 'title');
    },
    [onCloseOtherPanels, clearNoteSelectionCore, navigateToItem, notes],
  );

  const openNoteForView = useCallback(
    (note: Note) => {
      setRecentlyDuplicatedNoteId(null);
      setCurrentNote(note);
      setPanelMode('view');
      setIsNotePanelOpen(true);
      setValidationErrors([]);
      onCloseOtherPanels();
      navigateToItem(note, notes, 'title');
    },
    [onCloseOtherPanels, navigateToItem, notes],
  );

  const openNoteSettings = useCallback(() => {
    clearNoteSelectionCore();
    setNotesContentView('settings');
    onCloseOtherPanels();
  }, [onCloseOtherPanels, clearNoteSelectionCore]);

  const closeNoteSettingsView = useCallback(() => {
    setNotesContentView('list');
  }, []);

  const openNoteForViewRef = useRef(openNoteForView);
  useEffect(() => {
    openNoteForViewRef.current = openNoteForView;
  }, [openNoteForView]);

  const openNoteForViewBridge = useCallback((note: Note) => {
    openNoteForViewRef.current(note);
  }, []);

  useEffect(() => {
    registerNotesNavigation(openNoteForViewBridge);
    return () => registerNotesNavigation(null);
  }, [registerNotesNavigation, openNoteForViewBridge]);

  const currentItemIndex = currentNote ? notes.findIndex((n) => n.id === currentNote.id) : -1;
  const totalItems = notes.length;
  const hasPrevItem = currentItemIndex > 0;
  const hasNextItem = currentItemIndex >= 0 && currentItemIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || currentItemIndex <= 0) {
      return;
    }
    const prev = notes[currentItemIndex - 1];
    if (prev) {
      openNoteForView(prev);
    }
  }, [hasPrevItem, currentItemIndex, notes, openNoteForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || currentItemIndex < 0 || currentItemIndex >= notes.length - 1) {
      return;
    }
    const next = notes[currentItemIndex + 1];
    if (next) {
      openNoteForView(next);
    }
  }, [hasNextItem, currentItemIndex, notes, openNoteForView]);

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
      try {
        await notesApi.deleteNote(id);
        setNotes((prev) => prev.filter((note) => note.id !== id));
        if (isSelected(id)) {
          toggleNoteSelectedCore(id);
        }
      } catch (error: unknown) {
        const err = error as { message?: string; error?: string };
        const errorMessage = err?.message || err?.error || t('notes.deleteFailed');
        alert(errorMessage);
      }
    },
    [isSelected, toggleNoteSelectedCore, t],
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

  const getDuplicateConfig = useCallback((item: Note | null) => {
    if (!item) {
      return null;
    }
    return {
      defaultName: `Copy of ${item.title || 'Item'}`,
      nameLabel: 'Title',
      confirmOnly: false,
    };
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

  const executeDuplicate = useCallback(
    async (
      item: Note,
      newName: string,
    ): Promise<{ closePanel: () => void; highlightId?: string }> => {
      const payload = {
        title: (newName ?? item.title ?? '').trim() || 'Untitled',
        content: item.content ?? '',
        mentions: item.mentions ?? [],
      };
      const newNote = await createNote(payload);
      const highlightId =
        newNote?.id !== null && newNote?.id !== undefined ? String(newNote.id) : undefined;
      return { closePanel: closeNotePanel, highlightId };
    },
    [createNote, closeNotePanel],
  );

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];

  const onExportItem = useCallback((format: ExportFormat, item: Note) => {
    const result = exportItems({
      items: [item],
      format,
      config: notesExportConfig,
      filename: getNoteExportBaseFilename(item),
      title: 'Notes Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).catch((err) => {
        console.error('Export failed:', err);
        alert('Export failed. Please try again.');
      });
    }
  }, []);

  const _convertToTask = useCallback(
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

  const getDeleteMessage = (item: Note | null) => {
    if (!item) {
      return t('notes.deleteConfirmThis');
    }
    const itemName = item.title || 'this note';
    return `${t('notes.deleteConfirmNamed', { name: itemName })} ${t('bulk.cannotUndo')}`;
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
    closeNoteSettingsView,
    closeNotePanel,
    notesContentView,
    saveNote,
    createNote,
    deleteNote,
    deleteNotes,
    getDuplicateConfig,
    executeDuplicate,
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

    getDeleteMessage,

    recentlyDuplicatedNoteId,
    setRecentlyDuplicatedNoteId,

    exportFormats,
    onExportItem,

    detailFooterActions: pluginActions
      .filter((action) => action.id !== 'create-task-from-note' || hasTasksPlugin)
      .map((action) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        onClick:
          action.id === 'create-task-from-note' && openToTaskDialog
            ? (note) => openToTaskDialog(note)
            : action.onClick,
        className:
          action.id === 'create-task-from-note'
            ? 'h-9 text-xs px-3 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30'
            : 'h-9 text-xs px-3',
      })),

    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: currentItemIndex === -1 ? 0 : currentItemIndex + 1,
    totalItems,
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
