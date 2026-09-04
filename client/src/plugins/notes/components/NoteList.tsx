import {
  AtSign,
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Clock,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import type { Note } from '../types/notes';
import {
  getInitialNoteColumnCount,
  NOTES_COLUMN_COUNT_STORAGE_KEY,
  NOTES_SETTINGS_KEY,
  resolveNoteColumnCount,
  type NoteColumnCount,
} from '../utils/noteColumnCount';
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
  isNoteStringSortField,
  nextNoteTableSort,
  type NoteSortField,
  type NoteSortOrder,
} from '../utils/noteListSort';
import {
  getInitialNoteListViewMode,
  persistNoteListViewModeSession,
  resolveNoteListViewMode,
  type NoteListViewMode,
} from '../utils/noteListViewMode';
import { resolveVisibleNoteTableColumns, type NoteTableColumnId } from '../utils/noteTableColumns';

import { NoteListItem } from './NoteListItem';
import { NoteListTable } from './NoteListTable';
import { NoteQuickContextPanel } from './NoteQuickContextPanel';
import { NotesSettingsView, type NotesSettingsCategory } from './NotesSettingsView';

import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';

type SortField = NoteSortField;
type SortOrder = NoteSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'createdAt', label: 'Created' },
  { value: 'mentions', label: 'Mentions' },
];

export const NoteList: React.FC = () => {
  const { t } = useTranslation();
  const {
    notes,
    notesContentView,
    openNoteForView,
    openNoteForEdit,
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
  } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openNotePanel(null)),
    onSettings: () => openNoteSettings(),
  });

  const { searchTerm, setSearchTerm } = usePersistedListSearch('notes');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('notes.searchPlaceholder', { count: notes.length }),
  });
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<NoteColumnCount>(getInitialNoteColumnCount);
  const [listViewMode, setListViewModeState] = useState<NoteListViewMode>(
    getInitialNoteListViewMode,
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<NoteTableColumnId[]>(() =>
    resolveVisibleNoteTableColumns(null),
  );
  const [activeFilters, setActiveFilters] = useState<NoteListFilterSelection>([]);
  const [settingsCategory, setSettingsCategory] = useState<NotesSettingsCategory>('columns');

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const resolved = resolveNoteColumnCount(settings);
        const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as NoteColumnCount;
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
        if (next !== resolved) {
          updateSettings(NOTES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
        }
        const nextView = resolveNoteListViewMode(settings);
        setListViewModeState(nextView);
        persistNoteListViewModeSession(nextView);
        setVisibleColumnIds(resolveVisibleNoteTableColumns(settings));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: NoteColumnCount) => {
      const next = 3 as NoteColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistNoteListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(NOTES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: NoteListViewMode) => {
      setListViewModeState(mode);
      persistNoteListViewModeSession(mode);
      updateSettings(NOTES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isNoteStringSortField(field) || field === 'mentions' ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextNoteTableSort(primarySort, sortOrder, field);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);

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

  const visibleNoteIds = useMemo(() => sortedNotes.map((note) => String(note.id)), [sortedNotes]);

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

  const handleExportCSV = () => {
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
  };

  const handleExportPDF = async () => {
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
  };

  const {
    previewItem: previewNote,
    setPreviewItem: setPreviewNote,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  } = useQuickContextPreview({
    storeKey: 'notes',
    items: notes,
    getItemId: (note) => String(note.id),
  });

  const quickContextOpen = Boolean(showQuickContext && previewNote);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount, { quickContextOpen });
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount, { quickContextOpen });

  const handleOpenForView = (note: Note) => {
    markPendingAndOpen(note, () => attemptNavigation(() => openNoteForView(note)));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearNoteSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (note: Note) => {
    if (selectionMode) {
      toggleNoteSelected(String(note.id));
      return;
    }
    activateRow(note, (item) => attemptNavigation(() => openNoteForView(item)));
  };

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

  const handleQuickCreate = useCallback(
    async (title: string) => {
      const note = await createNote({ title, content: '' });
      setRecentlyDuplicatedNoteId(String(note.id));
    },
    [createNote, setRecentlyDuplicatedNoteId],
  );

  if (notesContentView === 'settings') {
    return (
      <div className="plugin-notes min-h-full bg-background">
        <div className="px-6 py-4">
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

  return (
    <div className={cn('plugin-notes', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.notes')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('notes.settings')}
                    variant="soft"
                    onClick={() => openNoteSettings()}
                  />
                  {sortedNotes.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                  <RoundExpandableQuickAdd
                    label={t('notes.quickAdd')}
                    placeholder={t('notes.quickAddPlaceholder')}
                    onCreate={handleQuickCreate}
                    defaultExpanded
                    variant={quickContextOpen ? 'soft' : 'primary'}
                  />
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('notes.searchPlaceholder', { count: notes.length })}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`notes.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('notes.addNote')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openNotePanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                Total <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('withMentions')}
              className={cn(
                isFilterActive('withMentions')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <AtSign className="h-3.5 w-3.5" />
              <span>
                With Mentions{' '}
                <span className="tabular-nums font-semibold">({stats.withMentions})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('withContent')}
              className={cn(
                isFilterActive('withContent')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>
                With Content{' '}
                <span className="tabular-nums font-semibold">({stats.withContent})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('recentlyUpdated')}
              className={cn(
                isFilterActive('recentlyUpdated')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                Updated 7d{' '}
                <span className="tabular-nums font-semibold">({stats.recentlyUpdated})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
            <Select
              value={primarySort}
              onValueChange={(value) => handlePrimarySortChange(value as SortField)}
            >
              <SelectTrigger
                className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                aria-label="Sort by"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="item-aligned"
                className="rounded-xl border-border/50 shadow-xl"
              >
                {SORT_FIELD_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="rounded-md text-xs"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0 text-xs"
              onClick={toggleSortOrder}
              aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="notes"
          isLoading={deleting}
        />
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'grid items-start gap-4',
              showQuickContext && previewNote ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
            )}
          >
            {showQuickContext && previewNote ? (
              <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
                <NoteQuickContextPanel
                  note={previewNote}
                  onClose={() => setPreviewNote(null)}
                  onOpenFullProfile={() => handleOpenForView(previewNote)}
                  onEdit={() => {
                    markPendingAndOpen(previewNote, () =>
                      attemptNavigation(() => openNoteForEdit(previewNote)),
                    );
                  }}
                />
              </aside>
            ) : null}
            <div className="flex min-w-0 flex-col gap-3">
              {sortedNotes.length === 0 ? (
                <ListEmptyState
                  message={searchTerm ? t('notes.noMatch') : t('notes.noYet')}
                  createLabel={!searchTerm ? t('notes.addNote') : undefined}
                  onCreate={
                    !searchTerm ? () => attemptNavigation(() => openNotePanel(null)) : undefined
                  }
                />
              ) : isTableView ? (
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
                  activeNoteId={previewNote?.id ?? null}
                  visibleColumnIds={visibleColumnIds}
                />
              ) : (
                <div
                  className={cn(
                    'grid gap-3',
                    effectiveColumnCount === 1 && 'grid-cols-1',
                    effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                    effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
                  )}
                >
                  {sortedNotes.map((note, index) => {
                    const noteIsSelected = isSelected(note.id);
                    return (
                      <NoteListItem
                        key={note.id}
                        note={note}
                        selected={noteIsSelected}
                        highlighted={recentlyDuplicatedNoteId === String(note.id)}
                        active={previewNote != null && String(previewNote.id) === String(note.id)}
                        onClick={() => handleRowActivate(note)}
                        columnCount={effectiveCardColumnCount}
                        checkbox={
                          selectionMode ? (
                            <input
                              type="checkbox"
                              checked={noteIsSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onChange={() => onVisibleRowCheckboxChange(note.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                              aria-label={
                                noteIsSelected ? t('notes.unselectNote') : t('notes.selectNote')
                              }
                            />
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
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
        </div>
      </div>
    </div>
  );
};
