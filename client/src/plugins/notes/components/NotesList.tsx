import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, StickyNote, ChevronUp, ChevronDown } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

type SortField = 'title' | 'createdAt' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const NotesList: React.FC = () => {
  const { notes, openNotePanel, openNoteForEdit, openNoteForView, deleteNote } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    noteId: string;
    noteTitle: string;
  }>({
    isOpen: false,
    noteId: '',
    noteTitle: ''
  });
  
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isMobileView, setIsMobileView] = useState(false);

  // Check screen size for responsive view
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
    return [...notes].sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;
      
      if (sortField === 'title') {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      } else if (sortField === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else { // updatedAt
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
  }, [notes, sortField, sortOrder]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const handleDelete = (id: string, title: string) => {
    setDeleteConfirm({
      isOpen: true,
      noteId: id,
      noteTitle: title
    });
  };

  const confirmDelete = () => {
    deleteNote(deleteConfirm.noteId);
    setDeleteConfirm({
      isOpen: false,
      noteId: '',
      noteTitle: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      noteId: '',
      noteTitle: ''
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>Notes</Heading>
          <Text variant="caption">Manage your notes and ideas</Text>
        </div>
        <div className="flex sm:block">
          <Button
            onClick={() => openNotePanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add Note
          </Button>
        </div>
      </div>

      <Card>
        {/* Desktop Table View */}
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
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    No notes yet. Click "Add Note" to get started.
                  </td>
                </tr>
              ) : (
                sortedNotes.map((note, idx) => (
                  <tr key={note.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-yellow-500" />
                        <div className="text-sm font-medium text-gray-900">{note.title}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-md">
                        {truncateContent(note.content)}
                      </div>
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
                          onClick={() => openNoteForView(note)}
                        >
                          View
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={Edit}
                          onClick={() => openNoteForEdit(note)}
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
          /* Mobile Card View */
          <div className="divide-y divide-gray-200">
            {sortedNotes.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No notes yet. Click "Add Note" to get started.
              </div>
            ) : (
              sortedNotes.map((note) => (
                <div key={note.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <StickyNote className="w-5 h-5 text-yellow-500" />
                      <div className="text-xs text-gray-500">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1">
                        <h3 className="text-sm font-medium text-gray-900">{note.title}</h3>
                      </div>
                      
                      {/* Note content preview */}
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">
                          {truncateContent(note.content, 80)}
                        </div>
                      </div>
                    </div>
                    {/* View button in top right */}
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        icon={Eye}
                        onClick={() => openNoteForView(note)}
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

      {/* Delete Confirmation Dialog */}
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