import { Link2, SlidersHorizontal, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_PROP_ROW_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';

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

export function TaskView({ task }: TaskViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const {
    closeTaskPanel,
    saveTask,
    validationErrors,
    clearValidationErrors,
    quickEditDraft,
    setQuickEditField,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useTasks();
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

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
      <DetailLayout gridClassName="grid-cols-1 lg:grid-cols-2" leftSidebar={contentColumn}>
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
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('tasks.quickEditDiscardMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </>
  );
}
