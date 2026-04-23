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
import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_SURFACE_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
import { TaskShareBlock } from './TaskShareBlock';
import { TaskStatusSelect } from './TaskStatusSelect';

interface TaskViewProps {
  task: any;
}

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

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('tasks.quickActions')}
        icon={Zap}
        iconPlugin="tasks"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
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
            className={DETAIL_QUICK_ACTION_ROW_CLASS}
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
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
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
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
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
  shareActions?: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: any) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function getTaskExportShareIconColorClass(actionId: string): string {
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

function TaskExportOptionsCard({
  task,
  exportFormats,
  onExportItem,
  shareActions,
}: TaskExportOptionsCardProps) {
  const { t } = useTranslation();
  const hasFormats = Array.isArray(exportFormats) && exportFormats.length > 0;
  const hasShareButtons = Array.isArray(shareActions) && shareActions.length > 0;
  if (!hasFormats && !hasShareButtons) {
    return null;
  }

  const exportLabelByFormat: Record<ExportFormat, string> = {
    txt: t('common.exportTxt'),
    csv: t('common.exportCsv'),
    pdf: t('common.exportPdf'),
  };

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('tasks.exportOptions')}
        icon={Download}
        iconPlugin="tasks"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
          {hasFormats
            ? exportFormats.map((format) => (
                <Button
                  key={format}
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  className={DETAIL_QUICK_ACTION_ROW_CLASS}
                  onClick={() => onExportItem(format, task)}
                >
                  {exportLabelByFormat[format]}
                </Button>
              ))
            : null}
          {hasShareButtons ? (
            <>
              {hasFormats ? <div className="w-full border-t border-border/60 pt-2 mt-0.5" /> : null}
              {shareActions!.map((action) => {
                const Icon = action.icon;
                const iconTint = getTaskExportShareIconColorClass(action.id);
                return (
                  <Button
                    key={action.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                    disabled={action.disabled}
                    className={cn(
                      DETAIL_QUICK_ACTION_ROW_CLASS,
                      'disabled:opacity-50',
                      action.className,
                    )}
                    onClick={() => action.onClick(task)}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </>
          ) : null}
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
    exportShareActions,
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
        const response = await apiFetch('/api/contacts');
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
        const response = await apiFetch('/api/notes');
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
      const response = await apiFetch('/api/contacts');
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
    <>
      <DetailLayout
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
              shareActions={exportShareActions}
            />

            {task.mentions && task.mentions.length > 0 && (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('tasks.mentionedContacts')}
                  icon={Users}
                  iconPlugin="tasks"
                  subtleTitle
                  className="p-4"
                >
                  <div className="space-y-1.5">
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
                            className={cn(DETAIL_SURFACE_ROW_CLASS, 'plugin-contacts')}
                          >
                            <span className="truncate text-xs text-muted-foreground">{name}</span>
                            {contactData ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={ExternalLink}
                                className="h-7 w-7 shrink-0 p-0 plugin-contacts text-plugin hover:bg-accent"
                                onClick={() => handleContactClick(mention.contactId)}
                                aria-label={`${t('common.open')} ${name}`}
                              >
                                <span className="sr-only">{t('common.open')}</span>
                              </Button>
                            ) : null}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </DetailSection>
              </Card>
            )}

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('tasks.information')}
                icon={Info}
                iconPlugin="tasks"
                subtleTitle
                className="p-4"
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('tasks', task.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-semibold text-foreground">
                      {new Date(task.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {task.createdFromNote && noteLoaded && (
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Source Note</span>
                      {sourceNote ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={handleNoteClick}
                          className="h-auto max-w-[150px] truncate p-0 text-[10px] plugin-notes text-plugin"
                        >
                          {sourceNote.title}
                        </Button>
                      ) : (
                        <span className="italic text-muted-foreground">Deleted Note</span>
                      )}
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

            <DetailActivityLog
              entityType="task"
              entityId={task.id}
              limit={30}
              title={t('tasks.activity')}
              showClearButton
              refreshKey={String(task.updatedAt ?? task.id)}
            />
          </div>
        }
      >
        <div className="space-y-6">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={String((displayTask ?? task)?.title || '').trim() || '—'}
              className="p-6"
              prominentTitle
            >
              <RichTextContent
                content={task.content}
                mentions={task.mentions}
                onMentionClick={handleContactClick}
              />
            </DetailSection>
          </Card>

          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('tasks.taskProperties')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-6"
            >
              <div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('tasks.propertyStatus')}
                  </span>
                  <TaskStatusSelect
                    task={displayTask ?? task}
                    onStatusChange={handleStatusChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('tasks.propertyPriority')}
                  </span>
                  <TaskPrioritySelect
                    task={displayTask ?? task}
                    onPriorityChange={handlePriorityChange}
                    hideInlineLabel
                  />
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('tasks.propertyDueDate')}
                  </span>
                  <TaskDueDatePicker
                    task={displayTask ?? task}
                    onDueDateChange={handleDueDateChange}
                    hideInlineLabel
                  />
                </div>
              </div>
            </DetailSection>
          </Card>

          <TaskAssigneeSelect task={displayTask ?? task} onAssigneeChange={handleAssigneeChange} />

          <TaskShareBlock task={task} />
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
    </>
  );
};
