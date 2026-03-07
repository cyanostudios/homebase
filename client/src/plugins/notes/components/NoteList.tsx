import {
  StickyNote,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  List as ListIcon,
  Upload,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';

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
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { ImportWizard } from '@/core/ui/ImportWizard';
import { exportItems } from '@/core/utils/exportUtils';
import type { ImportSchema } from '@/core/utils/importUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useNotes } from '../hooks/useNotes';
import { notesExportConfig } from '../utils/noteExportConfig';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const NOTE_VIEW_MODE_KEY = 'homebase-notes-view-mode';

const NOTE_IMPORT_SCHEMA: ImportSchema = {
  fields: [
    { key: 'title', label: 'Title', required: true },
    { key: 'content', label: 'Content', required: true },
  ],
};

export const NoteList: React.FC = () => {
  const { notes, openNoteForView, deleteNote, deleteNotes, importNotes } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const { setHeaderTrailing } = useContentLayout();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    noteId: string;
    noteTitle: string;
  }>({
    isOpen: false,
    noteId: '',
    noteTitle: '',
  });

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    try {
      const s = localStorage.getItem(NOTE_VIEW_MODE_KEY);
      return s === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });
  const [showImportWizard, setShowImportWizard] = useState(false);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(NOTE_VIEW_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search notes..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="h-4 w-4" />
              List
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowImportWizard(true)}>
              <Upload className="h-4 w-4" />
              Import
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, viewMode, setViewMode, setHeaderTrailing]);

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

  const selectedCount = selectedIds.size;
  const allSelected = sortedNotes.length > 0 && sortedNotes.every((n) => selectedIds.has(n.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedNotes.map((n) => n.id)));
    }
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    try {
      await deleteNotes(ids);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (selectedIds.size === 0) {
      alert('Please select notes to export');
      return;
    }
    const selectedNotes = notes.filter((n) => selectedIds.has(n.id));
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
    if (selectedIds.size === 0) {
      alert('Please select notes to export');
      return;
    }
    const selectedNotes = notes.filter((n) => selectedIds.has(n.id));
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
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: 'Export CSV',
            icon: FileSpreadsheet,
            onClick: handleExportCSV,
            variant: 'default',
          },
          {
            label: 'Export PDF',
            icon: FileText,
            onClick: handleExportPDF,
            variant: 'default',
          },
          {
            label: 'Delete…',
            icon: Trash2,
            onClick: () => setBulkDeleteOpen(true),
            variant: 'destructive',
          },
        ]}
      />

      <Card className="shadow-none">
        {sortedNotes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No notes found matching your search.'
              : 'No notes yet. Click "Add Note" to get started.'}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedNotes.map((note) => {
              const noteIsSelected = selectedIds.has(note.id);
              return (
                <Card
                  key={note.id}
                  className={cn(
                    'relative p-5 cursor-pointer transition-all flex flex-col h-fit min-h-[160px] border-transparent',
                    noteIsSelected
                      ? 'plugin-notes bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
                      : 'hover:border-plugin-subtle hover:plugin-notes hover:shadow-md',
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
                        onChange={() => toggleSelectOne(note.id)}
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
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
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
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer"
                    aria-label={allSelected ? 'Deselect all notes' : 'Select all notes'}
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
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
              {sortedNotes.map((note) => (
                <TableRow
                  key={note.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50"
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
                      checked={selectedIds.has(note.id)}
                      onChange={() => toggleSelectOne(note.id)}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={`Select ${note.title}`}
                    />
                  </TableCell>
                  <TableCell className="w-12">
                    <StickyNote className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImport={importNotes}
        schema={NOTE_IMPORT_SCHEMA}
        title="Import Notes"
      />

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

      <BulkDeleteModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        itemCount={selectedCount}
        itemLabel="notes"
        isLoading={bulkDeleting}
      />
    </div>
  );
};
