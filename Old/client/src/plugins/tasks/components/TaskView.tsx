import { User, Copy, Calendar, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Heading } from '@/core/ui/Typography';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { useTasks } from '../hooks/useTasks';

import { MentionContent } from './MentionContent';
import { TaskPriorityButtons } from './TaskPriorityButtons';
import { TaskStatusButtons } from './TaskStatusButtons';

interface TaskViewProps {
  task: any;
}

export const TaskView: React.FC<TaskViewProps> = ({ task }) => {
  const { openContactForView } = useContacts();
  const { closeTaskPanel, duplicateTask, saveTask } = useTasks();
  const { openNoteForView } = useNotes();
  const { contacts } = useApp();

  const [mentionContactsData, setMentionContactsData] = useState<{ [key: string]: any }>({});
  const [sourceNote, setSourceNote] = useState<any>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);

  useEffect(() => {
    const fetchMentionContactsData = async () => {
      if (!task?.mentions || task.mentions.length === 0) {
        return;
      }

      try {
        const response = await fetch('/api/contacts', { credentials: 'include' });
        if (response.ok) {
          const contactsData = await response.json();
          const mentionContactsMap: { [key: string]: any } = {};
          task.mentions.forEach((mention: any) => {
            const contact = contactsData.find((c: any) => c.id === mention.contactId);
            if (contact) {
              mentionContactsMap[mention.contactId] = contact;
            }
          });
          setMentionContactsData(mentionContactsMap);
        }
      } catch (error) {
        console.error('Failed to load contact data:', error);
      }
    };

    fetchMentionContactsData();
  }, [task?.mentions]);

  useEffect(() => {
    const fetchSourceNote = async () => {
      if (!task?.createdFromNote) {
        setNoteLoaded(true);
        return;
      }

      try {
        const response = await fetch('/api/notes', { credentials: 'include' });
        if (response.ok) {
          const notesData = await response.json();
          const note = notesData.find(
            (n: any) =>
              n.id === task.createdFromNote || n.id.toString() === task.createdFromNote.toString(),
          );
          setSourceNote(note);
        }
      } catch (error) {
        console.error('Failed to load source note:', error);
      }

      setNoteLoaded(true);
    };

    fetchSourceNote();
  }, [task?.createdFromNote]);

  const handleContactClick = async (contactId: string) => {
    try {
      const response = await fetch('/api/contacts', { credentials: 'include' });
      if (response.ok) {
        const contactsData = await response.json();
        const contact = contactsData.find((c: any) => c.id === contactId);

        if (contact) {
          const transformedContact = {
            ...contact,
            createdAt: new Date(contact.createdAt),
            updatedAt: new Date(contact.updatedAt),
          };

          closeTaskPanel();
          openContactForView(transformedContact);
        } else {
          console.error('Contact not found:', contactId);
          alert('Contact not found. It may have been deleted.');
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
      alert('Failed to load contact data. Please try again.');
    }
  };

  const handleNoteClick = async () => {
    if (!sourceNote) {
      return;
    }
    closeTaskPanel();
    openNoteForView(sourceNote);
  };

  const handleDuplicateTask = async () => {
    try {
      await duplicateTask(task);
      closeTaskPanel();
    } catch (error) {
      console.error('Failed to duplicate task:', error);
      alert('Failed to duplicate task. Please try again.');
    }
  };

  const formatDueDate = (dueDate: any) => {
    if (!dueDate) {
      return null;
    }

    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const dateString = due.toLocaleDateString();

    if (diffDays < 0) {
      return {
        text: `${dateString} (${Math.abs(diffDays)} days overdue)`,
        className: 'text-red-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-red-500',
      };
    } else if (diffDays === 0) {
      return {
        text: `${dateString} (Due today)`,
        className: 'text-orange-600 font-medium',
        icon: AlertCircle,
        iconClass: 'text-orange-500',
      };
    } else if (diffDays <= 3) {
      return {
        text: `${dateString} (Due in ${diffDays} day${diffDays === 1 ? '' : 's'})`,
        className: 'text-yellow-600 font-medium',
        icon: Calendar,
        iconClass: 'text-yellow-500',
      };
    } else {
      return {
        text: dateString,
        className: 'text-gray-900',
        icon: Calendar,
        iconClass: 'text-gray-500',
      };
    }
  };

  // Use correct property name from Contact type: personalNumber (not orgPersonNumber)
  const getAssignedContact = () => {
    if (!task?.assignedTo) {
      return null;
    }

    const contact = contacts.find((c: any) => c.id === task.assignedTo);
    if (!contact) {
      return null;
    }

    return {
      id: contact.id,
      companyName: contact.companyName,
      personalNumber: contact.personalNumber as string | undefined,
    };
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === task.status) {
      return;
    }

    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: newStatus,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
      };

      const success = await saveTask(updatedData);
      if (!success) {
        alert('Failed to update status. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === task.priority) {
      return;
    }

    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: task.status,
        priority: newPriority,
        dueDate: task.dueDate,
        assignedTo: task.assignedTo,
      };

      const success = await saveTask(updatedData);
      if (!success) {
        alert('Failed to update priority. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update priority:', error);
      alert('Failed to update priority. Please try igen.');
    }
  };

  const assignedContact = getAssignedContact();
  const dueDateInfo = formatDueDate(task?.dueDate);

  if (!task) {
    return null;
  }

  return (
    <div className="space-y-4">
      {(task.dueDate || assignedContact) && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
            Scheduling
          </Heading>
          <div className="space-y-3">
            {task.dueDate && dueDateInfo && (
              <div className="flex items-center gap-2">
                <dueDateInfo.icon className={`w-4 h-4 ${dueDateInfo.iconClass}`} />
                <span className="text-xs text-gray-500">Due:</span>
                <span className={`text-sm ${dueDateInfo.className}`}>{dueDateInfo.text}</span>
              </div>
            )}

            {assignedContact && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Assigned to:</span>
                <button
                  onClick={() => handleContactClick(assignedContact.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {assignedContact.companyName}
                  {assignedContact.personalNumber ? ` • ${assignedContact.personalNumber}` : ''}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Content
        </Heading>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-900 whitespace-pre-wrap">
            <MentionContent content={task.content} mentions={task.mentions} />
          </div>
        </div>
      </Card>

      {task.mentions && task.mentions.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
              Referenced Contacts
            </Heading>
            <div className="space-y-3">
              {task.mentions.map((mention: any, index: number) => {
                const contactData = mentionContactsData[mention.contactId];

                const getDisplayText = () => {
                  if (!contactData) {
                    const contactNumber = `#${mention.contactId}`;
                    const name = mention.contactName;
                    return `${contactNumber} • ${name} (deleted contact)`;
                  }

                  const contactNumber = `#${contactData.contactNumber || contactData.id}`;
                  const name = mention.contactName;
                  const orgPersonNumber =
                    contactData.organizationNumber || contactData.personalNumber || '';

                  return `${contactNumber} • ${name}${orgPersonNumber ? ` • ${orgPersonNumber}` : ''}`;
                };

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      contactData ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{getDisplayText()}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => (contactData ? handleContactClick(mention.contactId) : null)}
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
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Quick Actions
        </Heading>

        <TaskStatusButtons task={task} onStatusChange={handleStatusChange} />

        <TaskPriorityButtons task={task} onPriorityChange={handlePriorityChange} />

        <div className="mb-4">
          <div className="text-xs font-medium text-gray-700 mb-2">Task Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Copy} onClick={handleDuplicateTask}>
              Duplicate Task
            </Button>
          </div>
        </div>
      </Card>

      <hr className="border-gray-100" />

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
          Task Information
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{task.id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">
              {new Date(task.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">
              {new Date(task.updatedAt).toLocaleDateString()}
            </div>
          </div>
          {task.createdFromNote && noteLoaded && (
            <div className="sm:col-span-3">
              <div className="text-xs text-gray-500">Created from Note</div>
              {sourceNote ? (
                <button
                  onClick={handleNoteClick}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {sourceNote.title}
                </button>
              ) : (
                <div className="text-sm text-gray-500">
                  Note ID: {task.createdFromNote} (Deleted Note)
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
