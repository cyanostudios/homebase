import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { exportItems } from '@/core/utils/exportUtils';
import { stripHtml } from '@/core/utils/textUtils';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import {
  getInitialNoteColumnCount,
  NOTES_COLUMN_COUNT_STORAGE_KEY,
  NOTES_SETTINGS_KEY,
  resolveNoteColumnCount,
  type NoteColumnCount,
} from '../utils/noteColumnCount';
import {
  compareNotesByField,
  isNoteStringSortField,
  type NoteSortField,
  type NoteSortOrder,
} from '../utils/noteListSort';
import { notesExportConfig } from '../utils/noteExportConfig';

import { NoteListItem } from './NoteListItem';
import { NoteQuickAdd } from './NoteQuickAdd';
import { NotesSettingsView, type NotesSettingsCategory } from './NotesSettingsView';

type SortField = NoteSortField;
type SortOrder = NoteSortOrder;
type NoteFilter = 'all' | 'withMentions' | 'withContent' | 'recentlyUpdated';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'createdAt', label: 'Created' },
  { value: 'mentions', label: 'Mentions' },
];

const COLUMN_OPTIONS: NoteColumnCount[] = [1, 2, 3];

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
  } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<NoteColumnCount>(getInitialNoteColumnCount);
  const [activeFilter, setActiveFilter] = useState<NoteFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<NotesSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const next = resolveNoteColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: NoteColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(NOTES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(NOTES_SETTINGS_KEY, { columnCount: count }).catch(() => {});
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

  const sortedNotes = useMemo(() => {
    const byFilter = notes.filter((note) => {
      if (activeFilter === 'withMentions') {
        return (note.mentions?.length ?? 0) > 0;
      }
      if (activeFilter === 'withContent') {
        return stripHtml(note.content || '').trim().length > 0;
      }
      if (activeFilter === 'recentlyUpdated') {
        return Date.now() - new Date(note.updatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

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
  }, [notes, searchTerm, primarySort, sortOrder, activeFilter]);

  const visibleNoteIds = useMemo(() => sortedNotes.map((note) => String(note.id)), [sortedNotes]);
  const stats = useMemo(
    () => ({
      total: notes.length,
      withMentions: notes.filter((n) => (n.mentions?.length ?? 0) > 0).length,
      withContent: notes.filter((n) => stripHtml(n.content || '').trim().length > 0).length,
      recentlyUpdated: notes.filter(
        (n) => Date.now() - new Date(n.updatedAt).getTime() <= 7 * 24 * 60 * 60 * 1000,
      ).length,
    }),
    [notes],
  );

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

  const handleOpenForView = (note: (typeof notes)[0]) => {
    attemptNavigation(() => {
      openNoteForView(note);
    });
  };

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
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeNoteSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-notes min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.notes')}</h2>
            <p className="text-sm text-muted-foreground">{t('notes.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openNoteSettings()}
              title={t('notes.settings')}
            >
              {t('notes.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openNotePanel(null))}
            >
              {t('notes.addNote')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label="With Mentions"
            value={stats.withMentions}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'withMentions'}
            onClick={() => setActiveFilter('withMentions')}
          />
          <ListFilterStatCard
            label="With Content"
            value={stats.withContent}
            dotClassName="bg-amber-500"
            active={activeFilter === 'withContent'}
            onClick={() => setActiveFilter('withContent')}
          />
          <ListFilterStatCard
            label="Updated 7d"
            value={stats.recentlyUpdated}
            dotClassName="bg-violet-500"
            active={activeFilter === 'recentlyUpdated'}
            onClick={() => setActiveFilter('recentlyUpdated')}
          />
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
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={sortedNotes.length > 0}
            quickAddOpen={quickAddOpen}
            quickAddExpanded={
              quickAddOpen ? (
                <NoteQuickAdd
                  viewMode="grid"
                  layout="toolbar"
                  open={quickAddOpen}
                  onOpenChange={setQuickAddOpen}
                  onCreate={handleQuickCreate}
                />
              ) : null
            }
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={onToggleAllVisible}
              >
                {t('common.selectAll')}
              </Button>
            }
            leadingActions={
              quickAddOpen ? null : (
                <NoteQuickAdd
                  viewMode="grid"
                  layout="toolbar"
                  open={quickAddOpen}
                  onOpenChange={setQuickAddOpen}
                  onCreate={handleQuickCreate}
                />
              )
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('notes.searchPlaceholder', { count: notes.length })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                <div className="mr-1 flex items-center gap-1">
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
                <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                  {COLUMN_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                        columnCount === count
                          ? 'bg-background text-foreground shadow-sm hover:bg-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setColumnCount(count)}
                      aria-label={t(`notes.columns${count}`)}
                      aria-pressed={columnCount === count}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearNoteSelection}
                  type="button"
                >
                  {t('common.clearSelection')}
                </Button>
                <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {t('bulk.selected', { count: selectedCount })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FileSpreadsheet}
                  onClick={handleExportCSV}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('common.exportCsv')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={FileText}
                  onClick={handleExportPDF}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('common.exportPdf')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                >
                  {t('common.delete')}
                </Button>
              </>
            }
          />

          {sortedNotes.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950">
              {searchTerm ? t('notes.noMatch') : t('notes.noYet')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
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
                    onClick={() => handleOpenForView(note)}
                    columnCount={columnCount}
                    checkbox={
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
  );
};
