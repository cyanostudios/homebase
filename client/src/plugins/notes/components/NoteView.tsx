import React, { useState, useEffect } from 'react';
import { StickyNote, User, CheckSquare, Copy, Download } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { MentionContent } from './MentionContent';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { useApp } from '@/core/api/AppContext';

interface NoteViewProps {
  note: any;
}

export const NoteView: React.FC<NoteViewProps> = ({ note }) => {
  const { openContactForView } = useContacts();
  const { closeNotePanel, duplicateNote } = useNotes();
  const { saveTask, openTaskForView } = useTasks();
  const { refreshData } = useApp();

  const [contactsData, setContactsData] = useState<any[]>([]);
  const [showTaskCreated, setShowTaskCreated] = useState(false);

  useEffect(() => {
    const fetchContactsData = async () => {
      try {
        const response = await fetch('/api/contacts', {
          credentials: 'include'
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
        credentials: 'include'
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
        title: note.title,
        content: note.content,
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
    }
  };

  const handleDuplicateNote = async () => {
    try {
      await duplicateNote(note); // creates the copy (keeps list behavior unchanged)
      closeNotePanel();          // close panel when duplicating from View
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

  if (!note) return null;

  return (
    <div className="space-y-4">
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Content</Heading>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="prose prose-sm max-w-none text-sm">
            <MentionContent content={note.content} mentions={note.mentions || []} />
          </div>
        </div>
      </Card>

      <hr className="border-gray-100" />

      {note.mentions && note.mentions.length > 0 && (
        <>
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Mentioned Contacts</Heading>
            <div className="space-y-2">
              {note.mentions.map((mention: any, index: number) => {
                const contactData = contactsData.find((c: any) => c.id === mention.contactId);

                const getDisplayText = () => {
                  if (!contactData) {
                    const contactNumber = `#${mention.contactId}`;
                    const name = mention.contactName;
                    return `${contactNumber} • ${name} (deleted contact)`;
                  }
                  
                  const contactNumber = `#${contactData.contactNumber || contactData.id}`;
                  const name = mention.contactName;
                  const orgPersonNumber = contactData.organizationNumber || contactData.personalNumber || '';
                  
                  return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                };

                return (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                    contactData 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{getDisplayText()}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => contactData ? handleContactClick(mention.contactId) : null}
                      disabled={!contactData}
                      className={`ml-3 flex-shrink-0 ${
                        contactData 
                          ? 'text-blue-700 hover:text-blue-800' 
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {contactData ? 'View Contact' : 'Deleted'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>

          <hr className="border-gray-100" />
        </>
      )}

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</Heading>
        
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Note Actions</div>
          <div className="flex flex-wrap gap-2">
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={Download}
              onClick={handleExportNote}
            >
              Export as Text
            </Button>
            
            <Button 
              variant="secondary" 
              size="sm"
              icon={Copy}
              onClick={handleDuplicateNote}
            >
              Duplicate Note
            </Button>
            
            <Button 
              variant="primary" 
              size="sm"
              icon={CheckSquare}
              onClick={handleConvertToTask}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Convert to Task
            </Button>
          </div>
        </div>
      </Card>

      <hr className="border-gray-100" />

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Note Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{note.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(note.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(note.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>

      {showTaskCreated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Task Created Successfully!</h2>
                <p className="text-xs text-gray-500">From note: {note.title}</p>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Your note has been converted to a task and is ready to be worked on.
              </p>
              <p className="text-xs text-gray-500 italic">
                You can find the new task in the Tasks section with status "Not started".
              </p>
            </div>

            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowTaskCreated(false)}
                className="bg-green-600 hover:bg-green-700"
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