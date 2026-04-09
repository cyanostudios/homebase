import { ExternalLink, Share } from 'lucide-react';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { usePluginActions } from '@/core/api/ActionContext';
import { useApp } from '@/core/api/AppContext';
import { bulkApi } from '@/core/api/bulkApi';
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { useItemUrl } from '@/core/hooks/useItemUrl';
import { buildDeleteMessage } from '@/core/utils/deleteUtils';
import { exportItems, type ExportFormat } from '@/core/utils/exportUtils';
import { resolveSlug } from '@/core/utils/slugUtils';

import { noteShareApi, notesApi } from '../api/notesApi';
import { Note, NoteShare, ValidationError } from '../types/notes';
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
  mergeIntoNoteSelection: (ids: string[]) => void;
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
  /** Optional actions shown in detail panel quick actions (e.g. Share, "To Task") – same style as Delete/Export. */
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

interface NoteProviderProps {
  children: ReactNode;
  isAuthenticated: boolean;
  onCloseOtherPanels: () => void;
}

export function NoteProvider({ children, isAuthenticated, onCloseOtherPanels }: NoteProviderProps) {
  const { t } = useTranslation();
  const location = useLocation();
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
    mergeIntoSelection: mergeIntoNoteSelectionCore,
    clearSelection: clearNoteSelectionCore,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  const closeNotePanel = useCallback(() => {
    setIsNotePanelOpen(false);
    setCurrentNote(null);
    setPanelMode('create');
    setValidationErrors([]);
    navigateToBase();
  }, [navigateToBase]);

  useEffect(() => {
    registerPanelCloseFunction('notes', closeNotePanel);
    return () => {
      unregisterPanelCloseFunction('notes');
    };
  }, [registerPanelCloseFunction, unregisterPanelCloseFunction, closeNotePanel]);

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

  useEffect(() => {
    if (isAuthenticated) {
      loadNotes();
    } else {
      setNotes([]);
    }
  }, [isAuthenticated, loadNotes]);

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

  const notesDeepLinkPathSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (notes.length === 0) {
      return;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] !== 'notes') {
      return;
    }
    const slug = segments[1] ?? '';
    if (!slug) {
      notesDeepLinkPathSyncedRef.current = location.pathname;
      return;
    }
    const pathKey = location.pathname;
    if (notesDeepLinkPathSyncedRef.current === pathKey) {
      return;
    }
    const item = resolveSlug(slug, notes, 'title');
    notesDeepLinkPathSyncedRef.current = pathKey;
    if (item) {
      openNoteForViewRef.current(item as Note);
    }
  }, [location.pathname, notes]);

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
      const errors = validateNote(noteData);
      setValidationErrors(errors);

      const blockingErrors = errors.filter((error) => !error.message.includes('Warning'));
      if (blockingErrors.length > 0) {
        return false;
      }

      try {
        let savedNote: Note;

        if (currentNote) {
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

        const validationErrors: ValidationError[] = [];

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
        setValidationErrors([{ field: 'general', message: errorMessage }]);
      }
    },
    [isSelected, toggleNoteSelectedCore, t],
  );

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

  const mergeIntoNoteSelection = useCallback(
    (ids: string[]) => {
      mergeIntoNoteSelectionCore(ids);
    },
    [mergeIntoNoteSelectionCore],
  );

  const clearNoteSelection = useCallback(() => {
    clearNoteSelectionCore();
  }, [clearNoteSelectionCore]);

  const getDuplicateConfig = useCallback(
    (item: Note | null) => {
      if (!item) {
        return null;
      }
      const baseTitle = item.title?.trim() || 'Item';
      return {
        defaultName: `Copy of ${baseTitle}`,
        nameLabel: t('notes.title'),
        confirmOnly: false,
      };
    },
    [t],
  );

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
      const nextName = (newName ?? '').trim();
      const payload = {
        title: nextName || item.title?.trim() || 'Untitled',
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

  const [noteShareExistingShare, setNoteShareExistingShare] = useState<NoteShare | null>(null);
  const [noteShareShowDialog, setNoteShareShowDialog] = useState(false);
  const [noteShareIsCreatingShare, setNoteShareIsCreatingShare] = useState(false);

  useEffect(() => {
    if (panelMode === 'view' && currentNote?.id) {
      let cancelled = false;
      noteShareApi
        .getShares(currentNote.id)
        .then((shares) => {
          if (cancelled) {
            return;
          }
          const active = shares.find((s) => new Date(s.validUntil) > new Date());
          setNoteShareExistingShare(active || null);
        })
        .catch(() => {
          if (!cancelled) {
            setNoteShareExistingShare(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    setNoteShareExistingShare(null);
  }, [panelMode, currentNote?.id]);

  const defaultNoteShareValidUntil = useCallback((): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const handleNoteShareClick = useCallback(
    async (note: Note) => {
      if (noteShareExistingShare) {
        setNoteShareShowDialog(true);
        return;
      }
      setNoteShareIsCreatingShare(true);
      try {
        const share = await noteShareApi.createShare({
          noteId: note.id,
          validUntil: defaultNoteShareValidUntil(),
        });
        setNoteShareExistingShare(share);
        setNoteShareShowDialog(true);
      } catch (error) {
        console.error('Failed to create note share:', error);
        alert(error instanceof Error ? error.message : 'Failed to create share link');
      } finally {
        setNoteShareIsCreatingShare(false);
      }
    },
    [noteShareExistingShare, defaultNoteShareValidUntil],
  );

  const handleNoteCopyShareUrl = useCallback(() => {
    if (!noteShareExistingShare) {
      return;
    }
    const url = noteShareApi.generateShareUrl(noteShareExistingShare.shareToken);
    navigator.clipboard.writeText(url).catch(() => {});
  }, [noteShareExistingShare]);

  const handleNoteRevokeShare = useCallback(async () => {
    if (!noteShareExistingShare) {
      return;
    }
    try {
      await noteShareApi.revokeShare(noteShareExistingShare.id);
      setNoteShareExistingShare(null);
    } catch (error) {
      console.error('Failed to revoke note share:', error);
      alert('Failed to revoke share link');
    }
  }, [noteShareExistingShare]);

  const pluginDetailActions = useMemo(
    () =>
      pluginActions
        .filter((action) => {
          if (
            action.id === 'create-task-from-note' ||
            action.id === 'create-task-from-note-and-delete'
          ) {
            return hasTasksPlugin;
          }
          return true;
        })
        .map((action) => ({
          id: action.id,
          label: action.label,
          icon: action.icon,
          onClick: (note: Note) => {
            if (!openToTaskDialog) {
              void action.onClick(note);
              return;
            }
            if (action.id === 'create-task-from-note') {
              openToTaskDialog(note);
              return;
            }
            if (action.id === 'create-task-from-note-and-delete') {
              openToTaskDialog(note, { deleteNoteAfter: true });
              return;
            }
            void action.onClick(note);
          },
          className: undefined,
        })),
    [pluginActions, hasTasksPlugin, openToTaskDialog],
  );

  const shareDetailActions = useMemo(() => {
    if (panelMode !== 'view' || !currentNote) {
      return [];
    }
    const hasActiveShare =
      noteShareExistingShare && new Date(noteShareExistingShare.validUntil) > new Date();
    if (hasActiveShare && noteShareExistingShare) {
      const shareUrl = noteShareApi.generateShareUrl(noteShareExistingShare.shareToken);
      return [
        {
          id: 'view-share',
          label: 'View',
          icon: ExternalLink,
          onClick: (_item: Note) => {
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
          },
          className: 'h-9 text-xs px-3',
        },
      ];
    }
    return [
      {
        id: 'share',
        label: noteShareIsCreatingShare ? 'Creating Share…' : 'Share note',
        icon: Share,
        onClick: (note: Note) => {
          void handleNoteShareClick(note);
        },
        className: 'h-9 text-xs px-3',
        disabled: noteShareIsCreatingShare,
      },
    ];
  }, [
    panelMode,
    currentNote,
    noteShareExistingShare,
    noteShareIsCreatingShare,
    handleNoteShareClick,
  ]);

  const mergedDetailFooterActions = useMemo(
    () => [...shareDetailActions, ...pluginDetailActions],
    [shareDetailActions, pluginDetailActions],
  );

  const exportFormats: ExportFormat[] = ['txt', 'csv', 'pdf'];

  const onExportItem = useCallback(
    (format: ExportFormat, item: Note) => {
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
          setValidationErrors([{ field: 'general', message: t('common.exportFailed') }]);
        });
      }
    },
    [t],
  );

  const getDeleteMessage = (item: Note | null) =>
    buildDeleteMessage(t, 'notes', item?.title || undefined);

  const value: NoteContextType = {
    isNotePanelOpen,
    currentNote,
    panelMode,
    validationErrors,

    notes,

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
    selectedNoteIds,
    toggleNoteSelected,
    selectAllNotes,
    mergeIntoNoteSelection,
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

    detailFooterActions: mergedDetailFooterActions,

    noteShareExistingShare,
    noteShareShowDialog,
    setNoteShareShowDialog,
    noteShareIsCreatingShare,
    handleNoteCopyShareUrl,
    handleNoteRevokeShare,

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
