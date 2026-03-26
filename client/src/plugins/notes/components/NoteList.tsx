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

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

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
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [settingsCategory, setSettingsCategory] = useState<NotesSettingsCategory>('view');

  useEffect(() => {
    let cancelled = false;
    getSettings(NOTES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        setViewModeState(settings?.viewMode === 'grid' ? 'grid' : 'list');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
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
    const q = searchTerm.toLowerCase();
    const filtered = notes.filter(
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
  }, [notes, searchTerm, sortField, sortOrder]);

  const visibleNoteIds = useMemo(() => sortedNotes.map((note) => String(note.id)), [sortedNotes]);

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
    <div className="plugin-notes min-h-full bg-background">
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
          <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
            {t('nav.notes')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('notes.searchPlaceholder')}
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Settings}
            className="h-9 px-3 text-xs"
            onClick={() => openNoteSettings()}
            title={t('notes.settings')}
          >
            {t('notes.settings')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Grid3x3}
            className={cn('h-9 px-3 text-xs', viewMode === 'grid' && 'text-primary')}
            onClick={() => setViewMode('grid')}
          >
            {t('slots.grid')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={List}
            className={cn('h-9 px-3 text-xs', viewMode === 'list' && 'text-primary')}
            onClick={() => setViewMode('list')}
          >
            {t('slots.list')}
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

      <div className="px-6 pb-6 space-y-4">
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

        {sortedNotes.length === 0 ? (
          <Card className="mt-4 border border-border/70 bg-card p-6 text-center text-muted-foreground shadow-sm">
            {searchTerm ? t('notes.noMatch') : t('notes.noYet')}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedNotes.map((note) => {
              const noteIsSelected = isSelected(note.id);
              return (
                <Card
                  key={note.id}
                  className={cn(
                    'relative min-h-[160px] cursor-pointer border border-border/70 bg-card p-5 shadow-sm transition-all',
                    'flex flex-col',
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
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={noteIsSelected}
                        onChange={() => toggleNoteSelected(note.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          noteIsSelected ? t('notes.unselectNote') : t('notes.selectNote')
                        }
                      />
                      <h3 className="line-clamp-1 text-base font-semibold">{note.title}</h3>
                    </div>
                  </div>
                  <p className="mb-4 line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {truncateContent(note.content, 150)}
                  </p>
                  <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
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
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      <div>
                        {t('common.updated')}: {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                      <div>
                        {t('slots.created')}: {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-4 overflow-hidden border border-border/70 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
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
                    className="cursor-pointer select-none hover:bg-muted/50"
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
                  <TableHead>{t('notes.content')}</TableHead>
                  <TableHead>{t('notes.mentions')}</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
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
                    className="cursor-pointer select-none hover:bg-muted/50"
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
                {sortedNotes.map((note) => {
                  const noteIsSelected = isSelected(note.id);
                  return (
                    <TableRow
                      key={note.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
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
                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer"
                          checked={noteIsSelected}
                          onChange={() => toggleNoteSelected(note.id)}
                          aria-label={
                            noteIsSelected ? t('notes.unselectNote') : t('notes.selectNote')
                          }
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{note.title}</TableCell>
                      <TableCell>
                        <div className="max-w-[300px] line-clamp-2 text-sm text-muted-foreground">
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
                      <TableCell className="text-sm">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="notes"
        isLoading={deleting}
      />
    </div>
  );
};
