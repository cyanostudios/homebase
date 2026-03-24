import {
  Copy,
  Download,
  Edit,
  ExternalLink,
  Info,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import type { ExportFormat } from '@/core/utils/exportUtils';
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

const TASK_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

interface TaskQuickActionsCardProps {
  task: any;
  onEdit: (task: any) => void;
  onDeleteClick: () => void;
  onDuplicate: (task: any) => void;
  getDuplicateConfig: (
    item: any | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
}

function TaskQuickActionsCard({
  task,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
}: TaskQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(task));
  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

  return (
    <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
      <DetailSection title={t('tasks.quickActions')} icon={Zap} iconPlugin="tasks" className="p-4">
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={quickActionButtonClass}
            onClick={() => onEdit(task)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className={quickActionButtonClass}
              onClick={() => onDuplicate(task)}
            >
              {t('common.duplicate')}
            </Button>
          )}
        </div>
      </DetailSection>
    </Card>
  );
}

interface TaskExportOptionsCardProps {
  task: any;
  exportFormats: ExportFormat[];
  onExportItem: (format: ExportFormat, item: any) => void;
}

function TaskExportOptionsCard({ task, exportFormats, onExportItem }: TaskExportOptionsCardProps) {
  const { t } = useTranslation();
  if (!Array.isArray(exportFormats) || exportFormats.length === 0) {
    return null;
  }

  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';
  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('tasks.exportOptions')}
        icon={Download}
        iconPlugin="tasks"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {exportFormats.map((format) => (
            <Button
              key={format}
              type="button"
              variant="ghost"
              size="sm"
              icon={Download}
              className={quickActionButtonClass}
              onClick={() => onExportItem(format, task)}
            >
              {exportLabelByFormat[format]}
            </Button>
          ))}
        </div>
      </DetailSection>
    </Card>
  );
}

export const TaskView: React.FC<TaskViewProps> = ({ task }) => {
  const { t } = useTranslation();
  const { openContactForView } = useContacts();
  const {
    closeTaskPanel,
    openTaskForEdit,
    deleteTask,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedTaskId,
    getDeleteMessage,
    exportFormats,
    onExportItem,
    quickEditDraft,
    setQuickEditField,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useTasks();
  const { openNoteForView } = useNotes();
  const { refreshData } = useApp();

  const [mentionContactsData, setMentionContactsData] = useState<{ [key: string]: any }>({});
  const [sourceNote, setSourceNote] = useState<any>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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

  const handleConfirmDelete = async () => {
    if (!task) {
      return;
    }
    await deleteTask(task.id);
    setShowDeleteTaskConfirm(false);
    closeTaskPanel();
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

  const handleAssigneeChange = (newAssigneeIds: string[]) => {
    setQuickEditField('assignedToIds', newAssigneeIds);
  };

  if (!task) {
    return null;
  }

  return (
    <div
      className={cn(
        'plugin-tasks min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
        'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
      )}
    >
      <DetailLayout
        mainClassName="max-w-[920px]"
        sidebar={
          <div className="space-y-6">
            <TaskQuickActionsCard
              task={task}
              onEdit={openTaskForEdit}
              onDeleteClick={() => setShowDeleteTaskConfirm(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
            />
            <TaskExportOptionsCard
              task={task}
              exportFormats={exportFormats}
              onExportItem={onExportItem}
            />

            {task.mentions && task.mentions.length > 0 && (
              <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
                <div className="space-y-1.5 p-3 sm:p-4">
                  <div className="mb-0.5 flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">
                      {t('tasks.mentionedContacts')}
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-0">
                    {(() => {
                      const uniqueMentions = Array.from(
                        new Map((task.mentions || []).map((m: any) => [m.contactId, m])).values(),
                      );
                      return uniqueMentions.map((mention: any) => {
                        const contactData = mentionContactsData[mention.contactId] as
                          | { id: string | number; companyName?: string }
                          | undefined;
                        const name =
                          contactData?.companyName ?? mention.contactName ?? mention.contactId;

                        return (
                          <div
                            key={`mention-${mention.contactId}`}
                            className="rounded-lg border border-border px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="truncate text-sm font-medium">{name}</span>
                              </div>
                              <div className="shrink-0">
                                {contactData ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    icon={ExternalLink}
                                    className="h-9 w-9 shrink-0 p-0 plugin-contacts text-plugin hover:bg-accent"
                                    onClick={() => handleContactClick(mention.contactId)}
                                    aria-label={`${t('common.open')} ${name}`}
                                  >
                                    <span className="sr-only">{t('common.open')}</span>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </Card>
            )}

            <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
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
          <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
            <DetailSection title={t('tasks.taskContent')} className="p-6">
              <RichTextContent
                content={task.content}
                mentions={task.mentions}
                onMentionClick={handleContactClick}
              />
            </DetailSection>
          </Card>

          <Card padding="none" className={TASK_DETAIL_CARD_CLASS}>
            <div className="p-6 space-y-2">
              <div className="mb-1 flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {t('tasks.taskProperties')}
                </span>
              </div>
              <div className="rounded-lg border border-border p-4">
                <TaskStatusSelect task={displayTask ?? task} onStatusChange={handleStatusChange} />
              </div>
              <div className="rounded-lg border border-border p-4">
                <TaskPrioritySelect
                  task={displayTask ?? task}
                  onPriorityChange={handlePriorityChange}
                />
              </div>
              <div className="rounded-lg border border-border p-4">
                <TaskDueDatePicker
                  task={displayTask ?? task}
                  onDueDateChange={handleDueDateChange}
                />
              </div>
            </div>
          </Card>

          <TaskAssigneeSelect task={displayTask ?? task} onAssigneeChange={handleAssigneeChange} />
        </div>
      </DetailLayout>
      <ConfirmDialog
        isOpen={showDeleteTaskConfirm}
        title={t('dialog.deleteItem', { label: t('nav.task') })}
        message={task ? getDeleteMessage(task) : ''}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteTaskConfirm(false)}
        variant="danger"
      />
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

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(task, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedTaskId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(task)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(task)?.nameLabel ?? t('tasks.title')}
        confirmOnly={Boolean(getDuplicateConfig(task)?.confirmOnly)}
      />
    </div>
  );
};
