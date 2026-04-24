import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import { notesExportConfig } from '../utils/noteExportConfig';

import { NotesSettingsView, type NotesSettingsCategory } from './NotesSettingsView';

const NOTES_SETTINGS_KEY = 'notes';
const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';
type NoteFilter = 'all' | 'withMentions' | 'withContent' | 'recentlyUpdated';
const NOTES_VIEW_MODE_STORAGE_KEY = 'notes:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(NOTES_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

function stripHtml(html: string): string {
  if (!html) {
    return '';
  }
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

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
    openNotePanel,
  } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [activeFilter, setActiveFilter] = useState<NoteFilter>('all');
  const [settingsCategory, setSettingsCategory] = useState<NotesSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewModeState(nextMode);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(NOTES_VIEW_MODE_STORAGE_KEY, nextMode);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(NOTES_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(NOTES_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
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

    return [...filtered].sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      if (sortField === 'title') {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else {
        aValue = a.updatedAt;
        bValue = b.updatedAt;
      }

      if (sortField === 'title') {
        if (sortOrder === 'asc') {
          return (aValue as string).localeCompare(bValue as string);
        }
        return (bValue as string).localeCompare(aValue as string);
      }
      if (sortOrder === 'asc') {
        return (aValue as Date).getTime() - (bValue as Date).getTime();
      }
      return (bValue as Date).getTime() - (aValue as Date).getTime();
    });
  }, [notes, searchTerm, sortField, sortOrder, activeFilter]);

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
  const someVisibleSelected = useMemo(
    () => visibleNoteIds.some((id) => isSelected(id)),
    [visibleNoteIds, isSelected],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

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

  const truncateContent = (content: string, maxLength: number = 100) => {
    const plain = stripHtml(content);
    if (plain.length <= maxLength) {
      return plain;
    }
    return `${plain.substring(0, maxLength)}…`;
  };

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
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.notes')}</h2>
            <p className="text-sm text-muted-foreground">{t('notes.listDescription')}</p>
          </div>
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="With Mentions"
            value={stats.withMentions}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'withMentions'}
            onClick={() => setActiveFilter('withMentions')}
          />
          <StatCard
            label="With Content"
            value={stats.withContent}
            dotClassName="bg-amber-500"
            active={activeFilter === 'withContent'}
            onClick={() => setActiveFilter('withContent')}
          />
          <StatCard
            label="Updated 7d"
            value={stats.recentlyUpdated}
            dotClassName="bg-violet-500"
            active={activeFilter === 'recentlyUpdated'}
            onClick={() => setActiveFilter('recentlyUpdated')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearNoteSelection}
            actions={[
              {
                label: t('common.exportCsv'),
                icon: FileSpreadsheet,
                onClick: handleExportCSV,
                variant: 'default',
              },
              {
                label: t('common.exportPdf'),
                icon: FileText,
                onClick: handleExportPDF,
                variant: 'default',
              },
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="notes"
          isLoading={deleting}
        />

        <Card
          className={cn(
            'rounded-xl border-0',
            viewMode === 'grid'
              ? 'overflow-visible bg-transparent shadow-none'
              : 'overflow-hidden bg-white shadow-sm dark:bg-slate-950',
          )}
        >
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('notes.searchPlaceholder', { count: notes.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openNoteSettings()}
                title={t('notes.settings')}
              >
                {t('notes.settings')}
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={List}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>

          {sortedNotes.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('notes.noMatch') : t('notes.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedNotes.map((note, index) => {
                const noteIsSelected = isSelected(note.id);
                return (
                  <Card
                    key={note.id}
                    className={cn(
                      'relative flex h-full min-h-[160px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
                      noteIsSelected
                        ? 'plugin-notes border-plugin-subtle bg-plugin-subtle ring-1 ring-plugin-subtle/50'
                        : 'hover:border-plugin-subtle hover:plugin-notes hover:shadow-md',
                      recentlyDuplicatedNoteId === String(note.id) && HIGHLIGHT_CLASS,
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      e.preventDefault();
                      handleOpenForView(note);
                    }}
                    data-list-item={JSON.stringify(note)}
                    data-plugin-name="notes"
                    role="button"
                    aria-label={`Open note ${note.title}`}
                  >
                    <div className="flex items-center justify-between gap-2">
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
                      <span className="text-[10px] text-muted-foreground">
                        {note.mentions?.length ?? 0} {String(t('notes.mentions')).toLowerCase()}
                      </span>
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {note.title}
                    </h3>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 text-xs text-muted-foreground">
                      <p className="line-clamp-3">{truncateContent(note.content, 150)}</p>
                      <div className="text-[10px]">
                        {note.mentions && note.mentions.length > 0 ? (
                          <span className="font-medium plugin-contacts text-plugin">
                            @{note.mentions[0].contactName}
                            {note.mentions.length > 1 && ` +${note.mentions.length - 1}`}
                          </span>
                        ) : (
                          <span>{t('notes.noMentions')}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
                      <div>
                        {t('common.updated')}: {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                      <div>
                        {t('slots.created')}: {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          allVisibleSelected ? t('common.unselectAll') : t('common.selectAll')
                        }
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('notes.title')}</span>
                        {sortField === 'title' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">{t('notes.content')}</TableHead>
                    <TableHead className="text-xs">{t('notes.mentions')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('common.updated')}</span>
                        {sortField === 'updatedAt' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('slots.created')}</span>
                        {sortField === 'createdAt' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedNotes.map((note, index) => {
                    const noteIsSelected = isSelected(note.id);
                    return (
                      <TableRow
                        key={note.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          noteIsSelected && 'bg-plugin-subtle',
                          recentlyDuplicatedNoteId === String(note.id) && HIGHLIGHT_CLASS,
                        )}
                        tabIndex={0}
                        data-list-item={JSON.stringify(note)}
                        data-plugin-name="notes"
                        role="button"
                        aria-label={`Open note ${note.title}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return;
                          }
                          e.preventDefault();
                          handleOpenForView(note);
                        }}
                      >
                        <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer"
                            checked={noteIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(note.id)}
                            aria-label={
                              noteIsSelected ? t('notes.unselectNote') : t('notes.selectNote')
                            }
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{note.title}</TableCell>
                        <TableCell>
                          <div className="max-w-[300px] line-clamp-2 text-xs text-muted-foreground">
                            {truncateContent(note.content, 100)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {note.mentions && note.mentions.length > 0 ? (
                            <div className="text-sm">
                              <span>
                                @{note.mentions[0].contactName}
                                {note.mentions.length > 1 && ` +${note.mentions.length - 1}`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(note.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            Showing {sortedNotes.length} of {notes.length} Notes
          </div>
        </Card>
      </div>
    </div>
  );
};
