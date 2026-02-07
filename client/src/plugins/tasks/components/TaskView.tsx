import { User, Copy, Calendar, AlertCircle } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailCard } from '@/core/ui/DetailCard';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { useTasks } from '../hooks/useTasks';

import { MentionContent } from './MentionContent';
import { TaskPrioritySelect } from './TaskPrioritySelect';
import { TaskStatusSelect } from './TaskStatusSelect';
import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskDueDatePicker } from './TaskDueDatePicker';

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
        }
      }
    } catch (error) {
      console.error('Failed to load contact data:', error);
    }
  };

  const handleNoteClick = async () => {
    if (!sourceNote) {
      return;
    }
    closeTaskPanel();
    openNoteForView(sourceNote);
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
        text: `${dateString} (${Math.abs(diffDays)}d overdue)`,
        className: 'text-red-600 dark:text-red-400 font-medium',
        icon: AlertCircle,
        iconClass: 'text-red-500 dark:text-red-400',
      };
    } else if (diffDays === 0) {
      return {
        text: `${dateString} (Due today)`,
        className: 'text-orange-600 dark:text-orange-400 font-medium',
        icon: AlertCircle,
        iconClass: 'text-orange-500 dark:text-orange-400',
      };
    } else if (diffDays <= 3) {
      return {
        text: `${dateString} (${diffDays}d left)`,
        className: 'text-yellow-600 dark:text-yellow-400 font-medium',
        icon: Calendar,
        iconClass: 'text-yellow-500 dark:text-yellow-400',
      };
    } else {
      return {
        text: dateString,
        className: 'text-foreground',
        icon: Calendar,
        iconClass: 'text-muted-foreground',
      };
    }
  };

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

      await saveTask(updatedData, task.id);
    } catch (error) {
      console.error('Failed to update status:', error);
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

      await saveTask(updatedData, task.id);
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
  };

  const handleDueDateChange = async (newDate: Date | null) => {
    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: task.status,
        priority: task.priority,
        dueDate: newDate,
        assignedTo: task.assignedTo,
      };
      await saveTask(updatedData, task.id);
    } catch (error) {
      console.error('Failed to update due date:', error);
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string | null) => {
    try {
      const updatedData = {
        title: task.title,
        content: task.content,
        mentions: task.mentions,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assignedTo: newAssigneeId,
      };
      await saveTask(updatedData, task.id);
    } catch (error) {
      console.error('Failed to update assignment:', error);
    }
  };

  const assignedContact = getAssignedContact();
  const dueDateInfo = formatDueDate(task?.dueDate);

  if (!task) {
    return null;
  }

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Task Properties" className="p-4">
              <div className="space-y-2">
                <TaskStatusSelect task={task} onStatusChange={handleStatusChange} />
                <TaskPrioritySelect task={task} onPriorityChange={handlePriorityChange} />
                <TaskAssigneeSelect task={task} onAssigneeChange={handleAssigneeChange} />
                <TaskDueDatePicker task={task} onDueDateChange={handleDueDateChange} />
              </div>
            </DetailSection>
          </Card>

          {task.mentions && task.mentions.length > 0 && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Mentions" className="p-4">
                <div className="space-y-2">
                  {(() => {
                    const uniqueMentions = Array.from(
                      new Map((task.mentions || []).map((m: any) => [m.contactId, m])).values()
                    );
                    return uniqueMentions.map((mention: any) => {
                      const contactData = mentionContactsData[mention.contactId];
                      const getDisplayText = () => {
                        if (!contactData) {
                          const contactNumber = formatDisplayNumber('contacts', mention.contactId);
                          return `${contactNumber} • ${mention.contactName} (deleted)`;
                        }
                        const contactNumber = formatDisplayNumber('contacts', contactData.contactNumber || contactData.id);
                        return `${contactNumber} • ${mention.contactName}`;
                      };

                      return (
                        <div key={`mention-${mention.contactId}`} className="flex justify-between items-center text-[11px] plugin-contacts bg-plugin-subtle px-2 py-1.5 rounded-md border border-plugin-subtle">
                          <span className="text-muted-foreground truncate mr-2">{getDisplayText()}</span>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => (contactData ? handleContactClick(mention.contactId) : null)}
                            disabled={!contactData}
                            className={cn('h-auto p-0 text-[10px] font-medium', contactData ? 'text-plugin' : 'text-muted-foreground')}
                          >
                            {contactData ? 'View' : 'Deleted'}
                          </Button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </DetailSection>
            </Card>
          )}

          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Information" className="p-4">
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono font-medium">{formatDisplayNumber('tasks', task.id)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="font-medium">{new Date(task.updatedAt).toLocaleDateString()}</span>
                </div>
                {task.createdFromNote && noteLoaded && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Source Note</span>
                    {sourceNote ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={handleNoteClick}
                        className="h-auto p-0 text-[10px] plugin-notes text-plugin truncate max-w-[150px]"
                      >
                        {sourceNote.title}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground italic">Deleted Note</span>
                    )}
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>
        </div>
      }
    >
      <div className="space-y-6">
        <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
          <DetailSection title="Task Content" className="p-6">
            <div className="prose prose-sm max-w-none text-sm dark:prose-invert">
              <MentionContent content={task.content} mentions={task.mentions} />
            </div>
          </DetailSection>
        </Card>
      </div>
    </DetailLayout>
  );
};
