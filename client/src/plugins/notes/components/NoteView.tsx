import { CheckSquare, Copy, Download } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';

import { MentionContent } from './MentionContent';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { openContactForView } = useContacts();
  const { closeNotePanel, duplicateNote } = useNotes();
  const { saveTask } = useTasks();
  const { refreshData } = useApp();

  const [contactsData, setContactsData] = useState<any[]>([]);
  const [showTaskCreated, setShowTaskCreated] = useState(false);

  useEffect(() => {
    const fetchContactsData = async () => {
      try {
        const response = await fetch('/api/contacts', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setContactsData(data);
        }
      } catch (error) {
        console.error('Failed to load contacts data:', error);
      }
    };

    if (note?.mentions && note.mentions.length > 0) {
      fetchContactsData();
    }
  }, [note?.mentions]);

  const handleContactClick = async (contactId: string) => {
    await refreshData();

    try {
      const response = await fetch('/api/contacts', {
        credentials: 'include',
      });

      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);

        if (contact) {
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };

          closeNotePanel();
          openContactForView(transformedContact);
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  const handleConvertToTask = async () => {
    try {
      const taskData = {
        title: note.title || '',
        content: note.content || '', // Ensure content is always a string
        mentions: note.mentions || [],
        status: 'not started',
        priority: 'Medium',
        dueDate: null,
        assignedTo: null,
        createdFromNote: note.id,
      };

      const success = await saveTask(taskData);

      if (success) {
        setShowTaskCreated(true);
      }
    } catch (error) {
      console.error('Failed to convert note to task:', error);
      alert('Failed to convert note to task. Please try again.');
    }
  };

  const handleDuplicateNote = async () => {
    try {
      await duplicateNote(note); // creates the copy (keeps list behavior unchanged)
      closeNotePanel(); // close panel when duplicating from View
    } catch (error) {
      console.error('Failed to duplicate note:', error);
      alert('Failed to duplicate note. Please try again.');
    }
  };

  const handleExportNote = () => {
    const content = `${note.title}\n\n${note.content}\n\nCreated: ${new Date(note.createdAt).toLocaleDateString()}`;
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!note) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Content">
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <MentionContent content={note.content} mentions={note.mentions || []} />
            </div>
          </div>
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      {note.mentions && note.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="Mentioned Contacts">
              <div className="space-y-2">
                {note.mentions.map((mention: any) => {
                  const contactData = contactsData.find((c: any) => c.id === mention.contactId);

                  const getDisplayText = () => {
                    if (!contactData) {
                      const contactNumber = formatDisplayNumber('contacts', mention.contactId);
                      const name = mention.contactName;
                      return `${contactNumber} • ${name} (deleted contact)`;
                    }

                    const contactNumber = formatDisplayNumber(
                      'contacts',
                      contactData.contactNumber || contactData.id,
                    );
                    const name = mention.contactName;
                    const orgPersonNumber =
                      contactData.organizationNumber || contactData.personalNumber || '';

                    return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                  };

                  return (
                    <div
                      key={`mention-${mention.contactId}-${mention.contactName || 'unknown'}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        contactData
                          ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {getDisplayText()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => (contactData ? handleContactClick(mention.contactId) : null)}
                        disabled={!contactData}
                        className={`ml-3 flex-shrink-0 ${
                          contactData
                            ? 'text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {contactData ? 'View Contact' : 'Deleted'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          </Card>

          <hr className="border-gray-100 dark:border-gray-800" />
        </>
      )}

      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Quick Actions">
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Note Actions
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={Download} onClick={handleExportNote}>
                Export as Text
              </Button>

              <Button variant="secondary" size="sm" icon={Copy} onClick={handleDuplicateNote}>
                Duplicate Note
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={CheckSquare}
                onClick={handleConvertToTask}
                className="bg-green-500 dark:bg-green-600 text-white hover:bg-green-600 dark:hover:bg-green-700"
              >
                Convert to Task
              </Button>
            </div>
          </div>
        </DetailSection>
      </Card>

      <hr className="border-gray-100 dark:border-gray-800" />

      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Note Information">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">System ID</div>
              <div className="text-sm font-mono text-gray-900 dark:text-gray-100">
                {formatDisplayNumber('notes', note.id)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Created</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(note.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Last Updated</div>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {new Date(note.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>

      {showTaskCreated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Task Created Successfully!
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">From note: {note.title}</p>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your note has been converted to a task and is ready to be worked on.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                You can find the new task in the Tasks section with status "Not started".
              </p>
            </div>

            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100 dark:border-gray-700">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowTaskCreated(false)}
                className="bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-800"
              >
                Got it!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
