import {
  Plus,
  Edit,
  Trash2,
  Eye,
  StickyNote,
  ChevronUp,
  ChevronDown,
  Search,
  Copy,
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

import { useNotes } from '../hooks/useNotes';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const NotesList: React.FC = () => {
  const { notes, openNotePanel, openNoteForEdit, openNoteForView, deleteNote, duplicateNote } =
    useNotes();
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

  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return null;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const handleDelete = (id: string, title: string) => {
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

  const handleDuplicate = async (e: React.MouseEvent, note: any) => {
    e.stopPropagation();
    try {
      await duplicateNote(note);
    } catch (error) {
      console.error('Failed to duplicate note:', error);
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

  const handleOpenForEdit = (note: any) => {
    attemptNavigation(() => {
      openNoteForEdit(note);
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button onClick={handleOpenPanel} variant="primary" icon={Plus}>
            Add Note
          </Button>
        </div>
      </div>

      <Card>
        {!isMobileView ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    Title
                    <SortIcon field="title" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mentions
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-1">
                    Updated
                    <SortIcon field="updatedAt" />
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedNotes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    {searchTerm
                      ? 'No notes found matching your search.'
                      : 'No notes yet. Click "Add Note" to get started.'}
                  </td>
                </tr>
              ) : (
                sortedNotes.map((note, idx) => (
                  <tr
                    key={note.id}
                    className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-inset cursor-pointer`}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-yellow-500" />
                        <div className="text-sm font-medium text-gray-900">{note.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs line-clamp-2">
                        {truncateContent(note.content, 120)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {note.mentions && note.mentions.length > 0 && (
                        <div className="flex flex-col items-start gap-0.5">
                          {note.mentions.slice(0, 2).map((mention: any, index: number) => (
                            <span key={index} className="text-xs text-blue-600">
                              @{mention.contactName}
                            </span>
                          ))}
                          {note.mentions.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{note.mentions.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForView(note);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={(e) => handleDuplicate(e, note)}
                          title="Duplicate note"
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Edit}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForEdit(note);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedNotes.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                {searchTerm
                  ? 'No notes found matching your search.'
                  : 'No notes yet. Click "Add Note" to get started.'}
              </div>
            ) : (
              sortedNotes.map((note) => (
                <div key={note.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <StickyNote className="w-4 h-4 text-yellow-500" />
                      <div className="text-xs text-gray-500">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <h3 className="text-sm font-medium text-gray-900">{note.title}</h3>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">
                          {truncateContent(note.content, 80)}
                        </div>
                        {note.mentions && note.mentions.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {note.mentions.slice(0, 2).map((mention: any, index: number) => (
                              <span key={index} className="text-xs text-blue-600">
                                @{mention.contactName}
                              </span>
                            ))}
                            {note.mentions.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{note.mentions.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => handleOpenForView(note)}
                        className="h-8 px-3"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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
    </div>
  );
};
