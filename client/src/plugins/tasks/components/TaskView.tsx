import {
  Copy,
  Download,
  Edit,
  Info,
  Link2,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/core/api/apiFetch';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { buildSlug } from '@/core/utils/slugUtils';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import { useNotes } from '@/plugins/notes/hooks/useNotes';

import { useTasks } from '../hooks/useTasks';
import { buildTaskListQuickFieldsSavePayload } from '../utils/taskListSave';

import { TaskAssignedTeamSelect } from './TaskAssignedTeamSelect';
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

export function TaskView({ task }: TaskViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const {
    closeTaskPanel,
    openTaskForEdit,
    deleteTask,
    saveTask,
    validationErrors,
    clearValidationErrors,
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
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const [sourceNote, setSourceNote] = useState<any>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [showDeleteTaskConfirm, setShowDeleteTaskConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const contact of contacts) {
      map.set(String(contact.id), contact);
    }
    return map;
  }, [contacts]);

  const navigateToContact = (contact: Contact) => {
    closeTaskPanel();
    setViewingContact(null);
    navigate(`/contacts/${buildSlug(contact, contacts, 'companyName')}`);
  };

  const handleContactClick = (contactId: string) => {
    const contact = contactById.get(String(contactId));
    if (!contact) {
      return;
    }
    setViewingContact(contact);
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
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
  };

  // Display task merges saved task with quick-edit draft (status, priority, dueDate, assignee)
  const displayTask = React.useMemo(
    () => (task ? { ...task, ...(quickEditDraft || {}) } : null),
    [task, quickEditDraft],
  );

  const handlePriorityChange = (newPriority: string) => {
    setQuickEditField('priority', newPriority);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
  };

  const handleDueDateChange = (newDate: Date | null) => {
    setQuickEditField('dueDate', newDate);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
  };

  const handleAssigneeChange = async (newAssigneeIds: string[]) => {
    if (!task?.id) {
      return;
    }
    // Optimistic UI via draft; persist immediately (same as list status/priority).
    setQuickEditField('assignedToIds', newAssigneeIds);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(
      buildTaskListQuickFieldsSavePayload(task, { assignedToIds: newAssigneeIds }, quickEditDraft),
      task.id,
    );
  };

  const handleAssignedTeamChange = async (teamId: string | null) => {
    if (!task?.id) {
      return;
    }
    setQuickEditField('teamId', teamId);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(buildTaskListQuickFieldsSavePayload(task, { teamId }, quickEditDraft), task.id);
  };

  const blockingValidationErrors = validationErrors.filter(
    (error) => !String(error.message || '').includes('Warning'),
  );

  const uniqueMentions = useMemo(() => {
    const raw = (task?.mentions || []) as Array<{
      contactId: string;
      contactName?: string;
      companyName?: string;
    }>;
    return Array.from(new Map(raw.map((m) => [m.contactId, m])).values());
  }, [task?.mentions]);

  const updatedLabel = task?.updatedAt
    ? new Date(task.updatedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (!task) {
    return null;
  }

  const contentColumn = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={String((displayTask ?? task)?.title || '').trim() || '—'}
        className="p-6"
        prominentTitle
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={Edit}
            className="h-8 w-8 shrink-0 p-0 hidden md:inline-flex"
            onClick={() => openTaskForEdit(task)}
            aria-label={t('common.edit')}
            title={t('common.edit')}
          />
        }
      >
        {updatedLabel ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {t('common.updated')} {updatedLabel}
          </p>
        ) : null}
        <RichTextContent
          content={task.content}
          mentions={task.mentions}
          onMentionClick={handleContactClick}
        />
      </DetailSection>
    </Card>
  );

  return (
    <>
      <DetailLayout
        gridClassName="grid-cols-1 lg:grid-cols-[1.3fr_1fr_260px]"
        leftSidebar={contentColumn}
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

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('tasks.information')}
                icon={Info}
                iconPlugin="tasks"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {formatDisplayNumber('tasks', task.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-extrabold text-foreground">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-extrabold text-foreground">
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
          {blockingValidationErrors.length > 0 ? (
            <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
              <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
              <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                {blockingValidationErrors.map((error) => (
                  <li key={`${error.field}-${error.message}`}>{error.message}</li>
                ))}
              </ul>
            </Card>
          ) : null}

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
                {(displayTask ?? task).status !== 'completed' && (
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
                )}
              </div>
            </DetailSection>
          </Card>

          <TaskAssigneeSelect task={displayTask ?? task} onAssigneeChange={handleAssigneeChange} />

          {hasTeamsPlugin ? (
            <TaskAssignedTeamSelect
              task={displayTask ?? task}
              onTeamChange={handleAssignedTeamChange}
            />
          ) : null}

          {uniqueMentions.length > 0 ? (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={
                  <span className="inline-flex items-baseline gap-2">
                    <span>{t('tasks.mentionedContacts')}</span>
                    <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                      {t('tasks.quickContext.mentionsHint')}
                    </span>
                  </span>
                }
                icon={Link2}
                iconPlugin="contacts"
                subtleTitle
                className="p-6"
              >
                <QuickContextLinkTileGrid>
                  {uniqueMentions.map((mention) => {
                    const contactData = contactById.get(String(mention.contactId));
                    const name =
                      contactData?.companyName ??
                      mention.contactName ??
                      mention.companyName ??
                      mention.contactId;
                    const typeKey = contactData?.contactType === 'private' ? 'private' : 'company';
                    const isDeleted = !contactData;
                    return (
                      <QuickContextLinkTile
                        key={`mention-${mention.contactId}`}
                        label={t('nav.contact')}
                        meta={
                          isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)
                        }
                        metaClassName={
                          isDeleted
                            ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            : CONTACT_TYPE_COLORS[typeKey]
                        }
                        icon={Users}
                        iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                        onClick={
                          contactData ? () => handleContactClick(mention.contactId) : undefined
                        }
                        className={isDeleted ? 'opacity-70' : undefined}
                      >
                        {name}
                      </QuickContextLinkTile>
                    );
                  })}
                </QuickContextLinkTileGrid>
              </DetailSection>
            </Card>
          ) : null}

          <TaskShareBlock task={task} />
        </div>
      </DetailLayout>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />

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
}
