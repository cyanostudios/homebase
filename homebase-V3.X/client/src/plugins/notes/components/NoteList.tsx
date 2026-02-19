import {
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List,
  Settings,
  Upload,
} from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { exportItems } from '@/core/utils/exportUtils';
import { ImportSchema } from '@/core/utils/importUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import { notesExportConfig } from '../utils/noteExportConfig';

const NOTES_SETTINGS_KEY = 'notes';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const NOTE_IMPORT_SCHEMA: ImportSchema = {
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: true },
  ],
};

export const NoteList: React.FC = () => {
  const {
    notes,
    openNoteForView,
    openNoteSettings,
    deleteNote,
    deleteNotes,
    selectedNoteIds,
    toggleNoteSelected,
    selectAllNotes,
    clearNoteSelection,
    selectedCount,
    isSelected,
    importNotes,
    recentlyDuplicatedNoteId,
  } = useNotes();
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    noteId: string;
    noteTitle: string;
  }>({
    isOpen: false,
    noteId: '',
    noteTitle: '',
  });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { getSettings, updateSettings, settingsVersion } = useApp();
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');

  // Load notes settings from API (and when settings are updated elsewhere)
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

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedNotes = useMemo(() => {
    const filtered = notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (note.mentions &&
          note.mentions.some((mention: any) =>
            mention.contactName.toLowerCase().includes(searchTerm.toLowerCase()),
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
        } else {
          return (bValue as string).localeCompare(aValue as string);
        }
      } else {
        if (sortOrder === 'asc') {
          return (aValue as Date).getTime() - (bValue as Date).getTime();
        } else {
          return (bValue as Date).getTime() - (aValue as Date).getTime();
        }
      }
    });
  }, [notes, searchTerm, sortField, sortOrder]);

  // Visible note IDs for selection
  const visibleNoteIds = useMemo(() => sortedNotes.map((note) => String(note.id)), [sortedNotes]);

  // Selection helpers
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

  const onToggleAllVisible = () => {
    if (allVisibleSelected) {
      const set = new Set(visibleNoteIds);
      const remaining = selectedNoteIds.filter((id) => !set.has(id));
      selectAllNotes(remaining);
    } else {
      const union = Array.from(new Set([...selectedNoteIds, ...visibleNoteIds]));
      selectAllNotes(union);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteNotes(selectedNoteIds);
      setShowBulkDeleteModal(false);
      // clearNoteSelection is called automatically by deleteNotes
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      // Error is already handled in context
    } finally {
      setDeleting(false);
    }
  };

  const _handleDelete = (id: string, title: string) => {
    setDeleteConfirm({
      isOpen: true,
      noteId: id,
      noteTitle: title,
    });
  };

  const confirmDelete = () => {
    deleteNote(deleteConfirm.noteId);
    setDeleteConfirm({
      isOpen: false,
      noteId: '',
      noteTitle: '',
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      noteId: '',
      noteTitle: '',
    });
  };

  const handleExportCSV = () => {
    if (selectedNoteIds.length === 0) {
      alert('Please select notes to export');
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
      alert('Please select notes to export');
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
        alert('Export failed. Please try again.');
      });
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  };

  // Set header trailing (search + view mode toggle) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search notes..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openNoteSettings()}
              className="h-7 text-[10px] px-2"
            >
              Settings
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className="h-7 text-[10px] px-2"
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              icon={List}
              onClick={() => setViewMode('list')}
              className="h-7 text-[10px] px-2"
            >
              List
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportWizardOpen(true)}
              className="h-7 text-[10px] px-2"
            >
              Import
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing, openNoteSettings]);

  // Protected navigation handlers
  const handleOpenForView = (note: any) => {
    attemptNavigation(() => {
      openNoteForView(note);
    });
  };

  return (
    <div className="space-y-4">
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearNoteSelection}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setShowBulkDeleteModal(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none border-none bg-transparent">
        {sortedNotes.length === 0 ? (
          <Card className="shadow-none">
            <div className="p-6 text-center text-muted-foreground">
              {searchTerm
                ? 'No notes found matching your search.'
                : 'No notes yet. Click "Add Note" to get started.'}
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedNotes.map((note) => {
              const noteIsSelected = isSelected(note.id);
              return (
                <Card
                  key={note.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent',
                    noteIsSelected
                      ? 'plugin-notes bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-notes hover:shadow-md',
                    recentlyDuplicatedNoteId === String(note.id) &&
                      'bg-green-50 dark:bg-green-950/30',
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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={noteIsSelected}
                        onChange={() => toggleNoteSelected(note.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer h-4 w-4"
                        aria-label={noteIsSelected ? 'Unselect note' : 'Select note'}
                      />
                      <h3 className="font-semibold text-base line-clamp-1">{note.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                    {truncateContent(note.content, 150)}
                  </p>
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {note.mentions && note.mentions.length > 0 ? (
                          <span className="font-medium plugin-contacts text-plugin">
                            @{note.mentions[0].contactName}
                            {note.mentions.length > 1 && ` +${note.mentions.length - 1}`}
                          </span>
                        ) : (
                          <span>No mentions</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      <div>Updated: {new Date(note.updatedAt).toLocaleDateString()}</div>
                      <div>Created: {new Date(note.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : isMobile ? (
          // Mobile: Card layout
          <Card className="shadow-none">
            <div className="space-y-2 p-4">
              {sortedNotes.map((note) => {
                const noteIsSelected = isSelected(note.id);
                return (
                  <Card
                    key={note.id}
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={noteIsSelected}
                            onChange={() => toggleNoteSelected(note.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer h-5 w-5 flex-shrink-0 mt-0.5"
                            aria-label={noteIsSelected ? 'Unselect note' : 'Select note'}
                          />
                          <h3 className="font-semibold text-base truncate">{note.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {truncateContent(note.content, 100)}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {note.mentions && note.mentions.length > 0 ? (
                            <span>
                              @{note.mentions[0].contactName}
                              {note.mentions.length > 1 && ` +${note.mentions.length - 1}`}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                          <span>•</span>
                          <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        ) : (
          // Desktop: Table layout
          <Card className="shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer"
                      aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                      checked={allVisibleSelected}
                      onChange={onToggleAllVisible}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Title</span>
                      {sortField === 'title' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Mentions</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Updated</span>
                      {sortField === 'updatedAt' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Created</span>
                      {sortField === 'createdAt' &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 inline" />
                        ) : (
                          <ArrowDown className="h-3 w-3 inline" />
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
                        'cursor-pointer hover:bg-accent',
                        recentlyDuplicatedNoteId === String(note.id) &&
                          'bg-green-50 dark:bg-green-950/30',
                      )}
                      tabIndex={0}
                      data-list-item={JSON.stringify(note)}
                      data-plugin-name="notes"
                      role="button"
                      aria-label={`Open note ${note.title}`}
                      onClick={(e) => {
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
                          aria-label={noteIsSelected ? 'Unselect note' : 'Select note'}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{note.title}</TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground line-clamp-2 max-w-[300px]">
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
                          <span className="text-muted-foreground text-sm">—</span>
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
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteConfirm.noteTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="notes"
        isLoading={deleting}
      />

      <ImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        onImport={importNotes}
        schema={NOTE_IMPORT_SCHEMA}
        title="Import Notes"
      />
    </div>
  );
};
