import { AtSign, Calendar, AlertCircle, Info, SlidersHorizontal } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { useTasks } from '../hooks/useTasks';

import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskDueDatePicker } from './TaskDueDatePicker';
import { TaskPrioritySelect } from './TaskPrioritySelect';
import { TaskStatusSelect } from './TaskStatusSelect';

interface TaskViewProps {
  task: any;
}

export const TaskView: React.FC<TaskViewProps> = ({ task }) => {
  const { t } = useTranslation();
  const { openContactForView } = useContacts();
  const {
    closeTaskPanel,
    quickEditDraft,
    setQuickEditField,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useTasks();
  const { openNoteForView } = useNotes();
  const { contacts, refreshData } = useApp();

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
    await refreshData();
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

  const handleStatusChange = (newStatus: string) => {
    setQuickEditField('status', newStatus);
  };

  // Display task merges saved task with quick-edit draft (status, priority, dueDate, assignee)
  const displayTask = React.useMemo(
    () => (task ? { ...task, ...(quickEditDraft || {}) } : null),
    [task, quickEditDraft],
  );

  const handlePriorityChange = (newPriority: string) => {
    setQuickEditField('priority', newPriority);
  };

  const handleDueDateChange = (newDate: Date | null) => {
    setQuickEditField('dueDate', newDate);
  };

  const handleAssigneeChange = (newAssigneeId: string | null) => {
    setQuickEditField('assignedTo', newAssigneeId);
  };

  const _assignedContact = getAssignedContact();
  const _dueDateInfo = formatDueDate(task?.dueDate);

  if (!task) {
    return null;
  }

  return (
    <div className="plugin-tasks">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection
                title={t('tasks.taskProperties')}
                icon={SlidersHorizontal}
                iconPlugin="tasks"
                className="p-4"
              >
                <div className="space-y-2">
                  <TaskStatusSelect
                    task={displayTask ?? task}
                    onStatusChange={handleStatusChange}
                  />
                  <TaskPrioritySelect
                    task={displayTask ?? task}
                    onPriorityChange={handlePriorityChange}
                  />
                  <TaskAssigneeSelect
                    task={displayTask ?? task}
                    onAssigneeChange={handleAssigneeChange}
                  />
                  <TaskDueDatePicker
                    task={displayTask ?? task}
                    onDueDateChange={handleDueDateChange}
                  />
                </div>
              </DetailSection>
            </Card>

            {task.mentions && task.mentions.length > 0 && (
              <Card
                padding="none"
                className="overflow-hidden border-none shadow-sm bg-background/50"
              >
                <DetailSection
                  title={t('tasks.mentionedContacts')}
                  icon={AtSign}
                  iconPlugin="contacts"
                  className="p-4"
                >
                  <div className="space-y-2">
                    {(() => {
                      const uniqueMentions = Array.from(
                        new Map((task.mentions || []).map((m: any) => [m.contactId, m])).values(),
                      );
                      return uniqueMentions.map((mention: any) => {
                        const contactData = mentionContactsData[mention.contactId];
                        const getDisplayText = () => {
                          if (!contactData) {
                            const contactNumber = formatDisplayNumber(
                              'contacts',
                              mention.contactId,
                            );
                            return `${contactNumber} • ${mention.contactName} (deleted)`;
                          }
                          const contactNumber = formatDisplayNumber(
                            'contacts',
                            contactData.contactNumber || contactData.id,
                          );
                          return `${contactNumber} • ${mention.contactName}`;
                        };

                        return (
                          <div
                            key={`mention-${mention.contactId}`}
                            className="flex justify-between items-center text-[11px] plugin-contacts bg-plugin-subtle px-2 py-1.5 rounded-md border border-border/50"
                          >
                            <span className="text-muted-foreground truncate mr-2">
                              {getDisplayText()}
                            </span>
                            <Button
                              size="sm"
                              variant="link"
                              onClick={() =>
                                contactData ? handleContactClick(mention.contactId) : null
                              }
                              disabled={!contactData}
                              className={cn(
                                'h-auto p-0 text-[10px] font-medium',
                                contactData ? 'text-plugin' : 'text-muted-foreground',
                              )}
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
              <DetailSection title={t('tasks.information')} icon={Info} className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono font-medium">
                      {formatDisplayNumber('tasks', task.id)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {new Date(task.updatedAt).toLocaleDateString()}
                    </span>
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
            <DetailSection title={t('tasks.taskContent')} className="p-6">
              <RichTextContent
                content={task.content}
                mentions={task.mentions}
                onMentionClick={handleContactClick}
              />
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('tasks.quickEditDiscardMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </div>
  );
};
