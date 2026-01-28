import { StickyNote, ArrowUp, ArrowDown, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import React, { useState, useMemo, useRef, useEffect } from 'react';

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
import { exportToCSV, exportToPDF } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useNotes } from '../hooks/useNotes';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const NoteList: React.FC = () => {
  const {
    notes,
    openNoteForView,
    deleteNote,
    deleteNotes,
    selectedNoteIds,
    toggleNoteSelected,
    selectAllNotes,
    clearNoteSelection,
    selectedCount,
    isSelected,
  } = useNotes();
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

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
    const csvHeaders = ['title', 'content', 'createdAt', 'updatedAt', 'mentionsCount'];
    const csvData = selectedNotes.map((note) => ({
      title: note.title || '',
      content: (note.content || '').slice(0, 500),
      createdAt:
        note.createdAt instanceof Date
          ? note.createdAt.toISOString()
          : String(note.createdAt ?? ''),
      updatedAt:
        note.updatedAt instanceof Date
          ? note.updatedAt.toISOString()
          : String(note.updatedAt ?? ''),
      mentionsCount: Array.isArray(note.mentions) ? note.mentions.length : 0,
    }));
    const filename = `notes-export-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(csvData, filename, csvHeaders);
  };

  const handleExportPDF = async () => {
    if (selectedNoteIds.length === 0) {
      alert('Please select notes to export');
      return;
    }
    const selectedNotes = notes.filter((note) => selectedNoteIds.includes(String(note.id)));
    const pdfHeaders = [
      { key: 'title', label: 'Title' },
      { key: 'content', label: 'Content' },
      { key: 'createdAt', label: 'Created' },
      { key: 'updatedAt', label: 'Updated' },
      { key: 'mentionsCount', label: 'Mentions' },
    ];
    const pdfData = selectedNotes.map((note) => ({
      title: note.title || '',
      content: (note.content || '').slice(0, 80) + ((note.content || '').length > 80 ? '…' : ''),
      createdAt:
        note.createdAt instanceof Date
          ? note.createdAt.toLocaleDateString('sv-SE')
          : String(note.createdAt ?? ''),
      updatedAt:
        note.updatedAt instanceof Date
          ? note.updatedAt.toLocaleDateString('sv-SE')
          : String(note.updatedAt ?? ''),
      mentionsCount: Array.isArray(note.mentions) ? note.mentions.length : 0,
    }));
    const filename = `notes-export-${new Date().toISOString().split('T')[0]}`;
    await exportToPDF(pdfData, filename, pdfHeaders, 'Notes Export');
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  };

  // Set header trailing (search + filter) in ContentHeader
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search notes..."
      />,
    );
    return () => setHeaderTrailing(null);
  }, [searchTerm, setSearchTerm, setHeaderTrailing]);

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

      <Card className="shadow-none">
        {sortedNotes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm
              ? 'No notes found matching your search.'
              : 'No notes yet. Click "Add Note" to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4"
                    aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
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
              {sortedNotes.map((note) => {
                const noteIsSelected = isSelected(note.id);
                return (
                  <TableRow
                    key={note.id}
                    className="cursor-pointer hover:bg-accent"
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
                        className="h-4 w-4"
                        checked={noteIsSelected}
                        onChange={() => toggleNoteSelected(note.id)}
                        aria-label={noteIsSelected ? 'Unselect note' : 'Select note'}
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
                );
              })}
            </TableBody>
          </Table>
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
    </div>
  );
};
