import { Plus, StickyNote, Search } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { GroupedList } from '@/core/ui/GroupedList';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useNotes } from '../hooks/useNotes';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const NoteList: React.FC = () => {
  const { notes, openNotePanel, openNoteForView, deleteNote } = useNotes();
  const { attemptNavigation } = useGlobalNavigationGuard();
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

  const [sortField] = useState<SortField>('updatedAt');
  const [sortOrder] = useState<SortOrder>('desc');

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

  const handleOpenPanel = () => {
    attemptNavigation(() => {
      openNotePanel(null);
    });
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>
            Notes ({searchTerm ? sortedNotes.length : notes.length}
            {searchTerm && sortedNotes.length !== notes.length && ` of ${notes.length}`})
          </Heading>
          <Text variant="caption">Manage your notes and ideas</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 z-10" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10"
            />
          </div>
          <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>
            Add Note
          </Button>
        </div>
      </div>

      <Card>
        <GroupedList
          items={sortedNotes}
          groupConfig={null}
          emptyMessage={
            searchTerm
              ? 'No notes found matching your search.'
              : 'No notes yet. Click "Add Note" to get started.'
          }
          renderItem={(note, idx) => (
            <div
              key={note.id}
              className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset cursor-pointer transition-colors px-4 py-3`}
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
              {/* Rad 1: Icon + Title */}
              <div className="flex items-center gap-2 mb-1.5">
                <StickyNote className="w-4 h-4 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
                <div className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                  {note.title}
                </div>
              </div>

              {/* Rad 2: Content Preview */}
              <div className="text-xs text-muted-foreground line-clamp-2 mb-1">
                {truncateContent(note.content, 150)}
              </div>

              {/* Rad 3: Mentions + Updated Date */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {note.mentions && note.mentions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span>
                      @{note.mentions[0].contactName}
                      {note.mentions.length > 1 && ` +${note.mentions.length - 1}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {note.mentions && note.mentions.length > 0 && <span>•</span>}
                  <span>Updated {new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        />
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
    </div>
  );
};
