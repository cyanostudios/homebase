import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  History,
  Info,
  Link2,
  Minus,
  SlidersHorizontal,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
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
import { buildTaskListQuickFieldsSavePayload, quickEditFieldsForTask } from '../utils/taskListSave';
import { TASK_PRIORITY_COLORS, TASK_STATUS_COLORS, formatStatusForDisplay } from '../types/tasks';

import { TaskAssignedTeamSelect } from './TaskAssignedTeamSelect';
import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskDueDatePicker } from './TaskDueDatePicker';
import { TaskPrioritySelect } from './TaskPrioritySelect';
import { TaskQuickContextPanel } from './TaskQuickContextPanel';
import { TaskShareBlock } from './TaskShareBlock';
import { TaskStatusSelect } from './TaskStatusSelect';

function taskStatusIcon(status: string) {
  switch (status) {
    case 'in progress':
      return Clock;
    case 'completed':
      return CheckCircle2;
    case 'cancelled':
      return XCircle;
    default:
      return Circle;
  }
}

function taskPriorityIcon(priority: string) {
  switch (priority) {
    case 'High':
      return ArrowUp;
    case 'Low':
      return ArrowDown;
    default:
      return Minus;
  }
}

interface TaskViewProps {
  task: any;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
  /** Companion / browse-only: no edit chrome, local tabs (do not mutate URL). */
  readOnly?: boolean;
  /** Optional trailing control on the title row (e.g. companion Open full + Close). */
  headerTrailing?: React.ReactNode;
}

type TaskViewTab = 'information' | 'assignees' | 'linked' | 'activity';

const TASK_VIEW_TABS: TaskViewTab[] = ['information', 'assignees', 'linked', 'activity'];

/** Companion flyout: information (+ properties), assignees — no linked/activity. */
const TASK_VIEW_READONLY_TABS: TaskViewTab[] = ['information', 'assignees'];

function parseTaskViewTab(value: string | null): TaskViewTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && TASK_VIEW_TABS.includes(value as TaskViewTab)) {
    return value as TaskViewTab;
  }
  return 'information';
}

export function TaskView({
  task,
  stacked: _stacked = false,
  readOnly = false,
  headerTrailing,
}: TaskViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localTab, setLocalTab] = useState<TaskViewTab>('information');
  const urlTab = parseTaskViewTab(searchParams.get('tab'));
  const activeTab = readOnly ? localTab : urlTab;
  const setActiveTab = useCallback(
    (tab: TaskViewTab) => {
      if (readOnly) {
        setLocalTab(tab);
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [readOnly, setSearchParams],
  );

  useEffect(() => {
    if (readOnly) {
      setLocalTab('information');
    }
  }, [task?.id, readOnly]);

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

  // Only merge draft fields that belong to this task (soft preview shares one global draft).
  const scopedQuickEdit = useMemo(
    () => quickEditFieldsForTask(quickEditDraft, task?.id),
    [quickEditDraft, task?.id],
  );

  const displayTask = React.useMemo(
    () => (task ? { ...task, ...(scopedQuickEdit || {}) } : null),
    [task, scopedQuickEdit],
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!task?.id) {
      return;
    }
    setQuickEditField(task.id, 'status', newStatus);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(
      buildTaskListQuickFieldsSavePayload(task, { status: newStatus }, scopedQuickEdit),
      task.id,
    );
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!task?.id) {
      return;
    }
    setQuickEditField(task.id, 'priority', newPriority);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(
      buildTaskListQuickFieldsSavePayload(task, { priority: newPriority }, scopedQuickEdit),
      task.id,
    );
  };

  const handleDueDateChange = async (newDate: Date | null) => {
    if (!task?.id) {
      return;
    }
    setQuickEditField(task.id, 'dueDate', newDate);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(
      buildTaskListQuickFieldsSavePayload(task, { dueDate: newDate }, scopedQuickEdit),
      task.id,
    );
  };

  const handleAssigneeChange = async (newAssigneeIds: string[]) => {
    if (!task?.id) {
      return;
    }
    // Optimistic UI via draft; persist immediately (same as list status/priority).
    setQuickEditField(task.id, 'assignedToIds', newAssigneeIds);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(
      buildTaskListQuickFieldsSavePayload(task, { assignedToIds: newAssigneeIds }, scopedQuickEdit),
      task.id,
    );
  };

  const handleAssignedTeamChange = async (teamId: string | null) => {
    if (!task?.id) {
      return;
    }
    setQuickEditField(task.id, 'teamId', teamId);
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    await saveTask(buildTaskListQuickFieldsSavePayload(task, { teamId }, scopedQuickEdit), task.id);
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

  const assigneeCount = Array.isArray(displayTask?.assignedToIds)
    ? displayTask.assignedToIds.length
    : Array.isArray(task?.assignedToIds)
      ? task.assignedToIds.length
      : 0;

  const tabs = useMemo(() => {
    const all = [
      {
        id: 'information' as const,
        label: t('tasks.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'assignees' as const,
        label: t('tasks.tabs.assignees'),
        icon: Users,
        count: assigneeCount > 0 ? assigneeCount : null,
      },
      {
        id: 'linked' as const,
        label: t('tasks.tabs.linked'),
        icon: Link2,
        count: uniqueMentions.length > 0 ? uniqueMentions.length : null,
      },
      {
        id: 'activity' as const,
        label: t('tasks.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ];
    if (readOnly) {
      return all.filter((tab) => TASK_VIEW_READONLY_TABS.includes(tab.id));
    }
    return all;
  }, [assigneeCount, readOnly, t, uniqueMentions.length]);

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  if (!task) {
    return null;
  }

  const informationCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title={t('tasks.taskContent')} icon={FileText} subtleTitle className="p-6">
          <div className="min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere] [&_.rich-text-content]:break-words [&_.rich-text-content]:[overflow-wrap:anywhere] [&_.rich-text-content_pre]:whitespace-pre-wrap [&_.rich-text-content_pre]:break-words [&_.rich-text-content_pre]:overflow-x-hidden">
            <RichTextContent
              content={task.content}
              mentions={task.mentions}
              onMentionClick={handleContactClick}
            />
          </div>
        </DetailSection>
      </Card>
      {readOnly ? null : <TaskShareBlock task={task} />}
    </div>
  );

  const propertiesCard = (
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
            {readOnly ? (
              <StatusOutlineBadge
                icon={taskStatusIcon((displayTask ?? task).status)}
                className={
                  TASK_STATUS_COLORS[
                    (displayTask ?? task).status as keyof typeof TASK_STATUS_COLORS
                  ] ?? TASK_STATUS_COLORS['not started']
                }
              >
                {formatStatusForDisplay((displayTask ?? task).status)}
              </StatusOutlineBadge>
            ) : (
              <TaskStatusSelect
                task={displayTask ?? task}
                onStatusChange={handleStatusChange}
                hideInlineLabel
              />
            )}
          </div>
          <div className={DETAIL_PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('tasks.propertyPriority')}
            </span>
            {readOnly ? (
              <StatusOutlineBadge
                icon={taskPriorityIcon((displayTask ?? task).priority)}
                className={
                  TASK_PRIORITY_COLORS[
                    (displayTask ?? task).priority as keyof typeof TASK_PRIORITY_COLORS
                  ]
                }
              >
                {(displayTask ?? task).priority}
              </StatusOutlineBadge>
            ) : (
              <TaskPrioritySelect
                task={displayTask ?? task}
                onPriorityChange={handlePriorityChange}
                hideInlineLabel
              />
            )}
          </div>
          {(displayTask ?? task).status !== 'completed' && (
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('tasks.propertyDueDate')}
              </span>
              {readOnly ? (
                <span className={cn(DETAIL_FIELD_VALUE_CLASS, 'text-right')}>
                  {(displayTask ?? task).dueDate
                    ? new Date((displayTask ?? task).dueDate).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              ) : (
                <TaskDueDatePicker
                  task={displayTask ?? task}
                  onDueDateChange={handleDueDateChange}
                  hideInlineLabel
                />
              )}
            </div>
          )}
        </div>
      </DetailSection>
    </Card>
  );

  const assigneesCard = (
    <div className="space-y-4">
      <TaskAssigneeSelect
        task={displayTask ?? task}
        onAssigneeChange={handleAssigneeChange}
        readOnly={readOnly}
      />
      {hasTeamsPlugin ? (
        <TaskAssignedTeamSelect
          task={displayTask ?? task}
          onTeamChange={handleAssignedTeamChange}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  );

  const linkedCard = (
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
        {uniqueMentions.length > 0 ? (
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
                  meta={isDeleted ? t('contacts.deletedContact') : t(`contacts.type.${typeKey}`)}
                  metaClassName={
                    isDeleted
                      ? 'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : CONTACT_TYPE_COLORS[typeKey]
                  }
                  icon={Users}
                  iconClassName={isDeleted ? 'text-slate-400' : 'text-sky-600'}
                  onClick={contactData ? () => handleContactClick(mention.contactId) : undefined}
                  className={isDeleted ? 'opacity-70' : undefined}
                >
                  {name}
                </QuickContextLinkTile>
              );
            })}
          </QuickContextLinkTileGrid>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('tasks.tabs.linkedEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  return (
    <>
      <DetailLayout gridClassName="grid-cols-1">
        <div className="space-y-4">
          <TaskQuickContextPanel
            task={displayTask ?? task}
            headerBelow={tabChips}
            readOnly={readOnly}
            headerTrailing={headerTrailing}
          />

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

          {activeTab === 'information' ? informationCard : null}

          {activeTab === 'information' ? propertiesCard : null}
          {activeTab === 'assignees' ? assigneesCard : null}
          {!readOnly && activeTab === 'linked' ? linkedCard : null}
          {!readOnly && activeTab === 'activity' ? (
            <DetailActivityLog
              entityType="task"
              entityId={task.id}
              limit={30}
              title={t('tasks.activity')}
              showClearButton
              refreshKey={String(task.updatedAt ?? task.id)}
              systemId={formatDisplayNumber('tasks', task.id)}
            />
          ) : null}
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

      {readOnly ? null : (
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
      )}
    </>
  );
}
