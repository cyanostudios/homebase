import {
  AtSign,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  StickyNote,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { useRegisterBrowseOrder } from '@/core/hooks/useRegisterBrowseOrder';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import type { Note } from '../types/notes';
import { NOTES_SETTINGS_KEY } from '../utils/noteColumnCount';
import { notesExportConfig } from '../utils/noteExportConfig';
import {
  noteHasContent,
  noteHasMentions,
  noteIsRecentlyUpdated,
  noteMatchesListFilters,
  toggleNoteListFilter,
  type NoteListFilter,
  type NoteListFilterSelection,
} from '../utils/noteListFilter';
import {
  compareNotesByField,
  isNoteAscDefaultField,
  type NoteSortField,
  type NoteSortOrder,
} from '../utils/noteListSort';
import { resolveVisibleNoteTableColumns, type NoteTableColumnId } from '../utils/noteTableColumns';

import { NoteForm } from './NoteForm';
import { NoteListTable } from './NoteListTable';
import { NotesSettingsView, type NotesSettingsCategory } from './NotesSettingsView';
import { NotesStatisticsView } from './NotesStatisticsView';
import { NoteView } from './NoteView';

type SortField = NoteSortField;
type SortOrder = NoteSortOrder;

const NOTES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.notes.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'title', labelKey: 'notes.title' },
  { value: 'updatedAt', labelKey: 'common.updated' },
  { value: 'createdAt', labelKey: 'common.created' },
  { value: 'mentions', labelKey: 'notes.mentions' },
];

let pendingQuickContextNoteId: string | null = null;

export const NoteList: React.FC = () => {
  const { t } = useTranslation();
  const {
    notes,
    notesContentView,
    openNoteForView,
    openNoteSettings,
    closeNoteSettingsView,
    deleteNotes,
    selectedNoteIds,
    toggleNoteSelected,
    mergeIntoNoteSelection,
    selectAllNotes,
    clearNoteSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedNoteId,
    setRecentlyDuplicatedNoteId,
    openNotePanel,
    createNote,
    setBrowseOrderIds,
    isNotePanelOpen,
    panelMode,
    currentNote,
    saveNote,
    closeNotePanel,
    validationErrors,
  } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { getSettings, settingsVersion } = useApp();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openNotePanel(null)),
    onSettings: () => attemptNavigation(() => openNoteSettings()),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('notes');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('notes.searchPlaceholder', { count: notes.length }),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [visibleColumnIds, setVisibleColumnIds] = useState<NoteTableColumnId[]>(() =>
    resolveVisibleNoteTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<NoteListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<NotesSettingsCategory>('import');
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    NOTES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingNoteRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isNotePanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isNotePanelOpen && panelMode === 'view' && currentNote != null;
  const detailNote = inlinePanelView ? currentNote : previewNote;
  const activeListNoteId =
    (inlineForm || inlinePanelView) && currentNote != null
      ? currentNote.id
      : (previewNote?.id ?? null);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingNoteRef.current || !pendingQuickContextNoteId) {
      return;
    }
    const restored = notes.find((note) => String(note.id) === pendingQuickContextNoteId);
    if (restored) {
      setPreviewNote(restored);
      restoredPendingNoteRef.current = true;
      pendingQuickContextNoteId = null;
    }
  }, [notes]);

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setVisibleColumnIds(resolveVisibleNoteTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isNoteAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isNoteAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const sortedNotes = useMemo(() => {
    const byFilter = notes.filter((note) => noteMatchesListFilters(note, activeFilters));

    const q = searchTerm.toLowerCase();
    const filtered = byFilter.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        stripHtml(note.content).toLowerCase().includes(q) ||
        (note.mentions &&
          note.mentions.some((mention: { contactName: string }) =>
            mention.contactName.toLowerCase().includes(q),
          )),
    );

    return [...filtered].sort((a, b) => compareNotesByField(a, b, primarySort, sortOrder));
  }, [notes, searchTerm, primarySort, sortOrder, activeFilters]);

  const stats = useMemo(
    () => ({
      total: notes.length,
      withMentions: notes.filter((n) => noteHasMentions(n)).length,
      withContent: notes.filter((n) => noteHasContent(n)).length,
      recentlyUpdated: notes.filter((n) => noteIsRecentlyUpdated(n)).length,
    }),
    [notes],
  );

  const isFilterActive = (filter: NoteListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: NoteListFilter) => {
    setActiveFilters((prev) => toggleNoteListFilter(prev, filter));
  };

  useEffect(() => {
    if (!previewNote) {
      return;
    }
    const next = notes.find((note) => String(note.id) === String(previewNote.id));
    if (!next) {
      setPreviewNote(null);
      return;
    }
    if (next !== previewNote) {
      setPreviewNote(next);
    }
  }, [notes, previewNote]);

  useEffect(() => {
    if (!showDesktopSplit || !isNotePanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentNote) {
      setPreviewNote(currentNote);
    }
  }, [showDesktopSplit, isNotePanelOpen, panelMode, currentNote]);

  const visibleNoteIds = useMemo(() => sortedNotes.map((note) => String(note.id)), [sortedNotes]);

  useRegisterBrowseOrder(setBrowseOrderIds, visibleNoteIds);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleNoteIds,
      mergeIntoSelection: mergeIntoNoteSelection,
      toggleOne: toggleNoteSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleNoteIds.length > 0 && visibleNoteIds.every((id) => isSelected(id)),
    [visibleNoteIds, isSelected],
  );

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleNoteIds);
      const remaining = selectedNoteIds.filter((id) => !set.has(id));
      selectAllNotes(remaining);
    } else {
      const union = Array.from(new Set([...selectedNoteIds, ...visibleNoteIds]));
      selectAllNotes(union);
    }
  }, [allVisibleSelected, visibleNoteIds, selectedNoteIds, selectAllNotes]);

  const handleBulkDelete = async () => {
    if (selectedNoteIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteNotes(selectedNoteIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = useCallback(() => {
    if (selectedNoteIds.length === 0) {
      return;
    }
    const selectedNotes = notes.filter((note) => selectedNoteIds.includes(String(note.id)));
    const filename = `notes-export-${new Date().toISOString().split('T')[0]}`;
    exportItems({
      items: selectedNotes,
      format: 'csv',
      config: notesExportConfig,
      filename,
      title: 'Notes Export',
    });
  }, [notes, selectedNoteIds]);

  const handleExportPDF = useCallback(async () => {
    if (selectedNoteIds.length === 0) {
      return;
    }
    const selectedNotes = notes.filter((note) => selectedNoteIds.includes(String(note.id)));
    const filename = `notes-export-${new Date().toISOString().split('T')[0]}`;
    const result = exportItems({
      items: selectedNotes,
      format: 'pdf',
      config: notesExportConfig,
      filename,
      title: 'Notes Export',
    });
    if (result && typeof (result as Promise<void>).then === 'function') {
      await (result as Promise<void>).catch((err) => {
        console.error('PDF export failed:', err);
      });
    }
  }, [notes, selectedNoteIds]);

  const handleOpenForView = (note: Note) => {
    pendingQuickContextNoteId = String(note.id);
    attemptNavigation(() => openNoteForView(note));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearNoteSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (note: Note) => {
    if (isCompactViewport) {
      handleOpenForView(note);
      return;
    }
    if (selectionMode) {
      toggleNoteSelected(String(note.id));
      return;
    }
    if (
      isNotePanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeNotePanel();
        setPreviewNote(note);
      });
      return;
    }
    setPreviewNote((current) => (current && String(current.id) === String(note.id) ? null : note));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeNotePanel();
  }, [closeNotePanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveNote>[0]) => {
      const ok = await saveNote(data);
      return ok;
    },
    [saveNote],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const note = await createNote({ title, content: '' });
      setRecentlyDuplicatedNoteId(String(note.id));
    },
    [createNote, setRecentlyDuplicatedNoteId],
  );

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'csv',
        label: t('common.exportCsv'),
        icon: FileSpreadsheet,
        disabled,
        onClick: handleExportCSV,
      },
      {
        key: 'pdf',
        label: t('common.exportPdf'),
        icon: FileText,
        disabled,
        onClick: () => {
          void handleExportPDF();
        },
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t, handleExportCSV, handleExportPDF]);

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('notes.stats.total'),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'withMentions',
        active: isFilterActive('withMentions'),
        icon: AtSign,
        label: t('notes.stats.withMentions'),
        count: stats.withMentions,
        onClick: () => toggleFilter('withMentions'),
      },
      {
        key: 'withContent',
        active: isFilterActive('withContent'),
        icon: FileText,
        label: t('notes.stats.withContent'),
        count: stats.withContent,
        onClick: () => toggleFilter('withContent'),
      },
      {
        key: 'recentlyUpdated',
        active: isFilterActive('recentlyUpdated'),
        icon: Clock,
        label: t('notes.stats.recentlyUpdated'),
        count: stats.recentlyUpdated,
        onClick: () => toggleFilter('recentlyUpdated'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('notes.sort')}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('notes.sort')}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc' ? t('notes.sortAsc') : t('notes.sortDesc')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('notes.sortAsc')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('notes.sortDesc')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (sortedNotes.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

  if (notesContentView === 'settings') {
    return (
      <div className="plugin-notes min-h-full bg-background">
        <div className="px-4 py-4 md:px-6">
          <NotesSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            onClose={closeNoteSettingsView}
          />
        </div>
      </div>
    );
  }

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={toolbarCollapsed ? t('notes.expandToolbar') : t('notes.collapseToolbar')}
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="notes-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailNote || inlineForm);

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-notes flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="notes-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.notes')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('notes.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openNoteSettings())}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableQuickAdd
                      icon={StickyNote}
                      label={t('notes.quickAdd')}
                      placeholder={t('notes.quickAddPlaceholder')}
                      onCreate={handleQuickCreate}
                      defaultExpanded
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                    />
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('notes.searchPlaceholder', { count: notes.length })}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('notes.addNote')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openNotePanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel="notes"
            isLoading={deleting}
          />

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {sortedNotes.length === 0 ? (
                  <ListEmptyState
                    message={searchTerm ? t('notes.noMatch') : t('notes.noYet')}
                    createLabel={!searchTerm ? t('notes.addNote') : undefined}
                    onCreate={
                      !searchTerm ? () => attemptNavigation(() => openNotePanel(null)) : undefined
                    }
                  />
                ) : (
                  <NoteListTable
                    notes={sortedNotes}
                    primarySort={primarySort}
                    sortOrder={sortOrder}
                    onSort={handleTableSort}
                    isSelected={isSelected}
                    onRowClick={handleRowActivate}
                    onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
                    onCheckboxChange={onVisibleRowCheckboxChange}
                    allVisibleSelected={allVisibleSelected}
                    onHeaderCheckboxChange={onToggleAllVisible}
                    recentlyDuplicatedNoteId={recentlyDuplicatedNoteId}
                    selectionEnabled={selectionMode}
                    activeNoteId={activeListNoteId}
                    visibleColumnIds={visibleColumnIds}
                  />
                )}

                <ListFooterBar
                  meta={
                    <>
                      Showing {sortedNotes.length} of {notes.length} Notes
                    </>
                  }
                />
              </div>
            </div>

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('notes.quickContext.title')}
                aria-live="polite"
              >
                {inlineForm ? (
                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="flex shrink-0 justify-end">
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                      />
                    </div>
                    <NoteForm
                      ref={inlineFormRef}
                      currentNote={currentNote}
                      onSave={handleInlineFormOnSave}
                      onCancel={closeNotePanel}
                      stacked
                    />
                  </div>
                ) : detailNote ? (
                  <NoteView note={detailNote} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <NotesStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
