import {
  CheckSquare,
  FileText,
  History,
  Info,
  Link2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { FORM_INPUT_ERROR_CLASS } from '@/core/ui/formFieldStyles';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DETAIL_FORM_TITLE_INPUT_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

import { TaskAssignedTeamSelect } from './TaskAssignedTeamSelect';
import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskDueDatePicker } from './TaskDueDatePicker';
import { TaskPrioritySelect } from './TaskPrioritySelect';
import { TaskStatusSelect } from './TaskStatusSelect';

const RichTextEditor = React.lazy(() =>
  import('@/core/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })),
);

type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number];
type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];

type TaskFormTab = 'information' | 'assignees' | 'linked' | 'activity';

const TASK_FORM_TABS: TaskFormTab[] = ['information', 'assignees', 'linked', 'activity'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const TASK_FORM_EDIT_DISABLED_TABS: ReadonlySet<TaskFormTab> = new Set(['linked', 'activity']);

const TAB_ERROR_FIELDS: Record<TaskFormTab, string[]> = {
  information: ['title', 'content', 'status', 'priority', 'dueDate'],
  assignees: [],
  linked: [],
  activity: [],
};

function parseTaskFormTab(value: string | null): TaskFormTab {
  if (value === 'properties') {
    return 'information';
  }
  if (value && TASK_FORM_TABS.includes(value as TaskFormTab)) {
    return value as TaskFormTab;
  }
  return 'information';
}

interface TaskFormState {
  title: string;
  content: string;
  mentions: any[];
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignedToIds: string[];
  teamId: string | null;
}

interface TaskFormProps {
  currentTask?: any;
  onSave: (data: TaskFormState) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}

export const TaskForm = React.forwardRef<PanelFormHandle, TaskFormProps>(function TaskForm(
  {
    currentTask,
    onSave,
    onCancel,
    isSubmitting: externalIsSubmitting = false,
    stacked: _stacked = false,
  },
  ref,
) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTaskFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: TaskFormTab, replace = false) => {
      if (TASK_FORM_EDIT_DISABLED_TABS.has(tab)) {
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
        { replace },
      );
    },
    [setSearchParams],
  );

  // Linked / Activity stay visible (greyed) but are not editable — leave those tabs if URL preserved them from View.
  useEffect(() => {
    if (!TASK_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

  const { validationErrors, clearValidationErrors } = useTasks();
  const enabledPlugins = useEnabledPlugins();
  const hasTeamsPlugin = enabledPlugins.has('teams');
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<TaskFormState>({
    title: '',
    content: '',
    mentions: [],
    status: 'not started',
    priority: 'Medium',
    dueDate: null,
    assignedToIds: [],
    teamId: null,
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  // While create/edit is open, block list + sidebar navigation (same discard prompt as Close).
  useEffect(() => {
    const formKey = `task-form-${currentTask?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [currentTask, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: [],
      status: 'not started',
      priority: 'Medium',
      dueDate: null,
      assignedToIds: [],
      teamId: null,
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentTask) {
      setFormData({
        title: currentTask.title || '',
        content: currentTask.content || '',
        mentions: currentTask.mentions || [],
        status: (currentTask.status as TaskStatus) || 'not started',
        priority: (currentTask.priority as TaskPriority) || 'Medium',
        dueDate: currentTask.dueDate || null,
        assignedToIds: Array.isArray(currentTask.assignedToIds)
          ? currentTask.assignedToIds.map((id: any) => String(id))
          : currentTask.assignedTo
            ? [String(currentTask.assignedTo)]
            : [],
        teamId:
          currentTask.teamId !== null &&
          currentTask.teamId !== undefined &&
          currentTask.teamId !== ''
            ? String(currentTask.teamId)
            : null,
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentTask, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success) {
        markClean();
        if (!currentTask) {
          resetForm();
        }
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentTask, resetForm, isCurrentlySubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(
      () => {
        onCancel();
      },
      { force: true },
    );
  }, [attemptAction, onCancel]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSubmit(),
      cancel: handleCancel,
    }),
    [handleSubmit, handleCancel],
  );

  const handleDiscardChanges = () => {
    if (!currentTask) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
      onCancel();
    }
  };

  const handleContentChange = (content: string, mentions: any[]) => {
    setFormData((prev) => ({ ...prev, content, mentions }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const updateField = <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    markDirty();
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  const tabHasError = useCallback(
    (tab: TaskFormTab) => {
      const fields = TAB_ERROR_FIELDS[tab];
      if (!fields.length) {
        return false;
      }
      return validationErrors.some(
        (error) => fields.includes(error.field) && !error.message.includes('Warning'),
      );
    },
    [validationErrors],
  );

  const assigneeCount = formData.assignedToIds.length;
  const linkedCount = useMemo(() => {
    const raw = formData.mentions || [];
    return new Map(raw.map((m: { contactId: string }) => [m.contactId, m])).size;
  }, [formData.mentions]);

  const tabs = useMemo(
    () => [
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
        count: linkedCount > 0 ? linkedCount : null,
      },
      {
        id: 'activity' as const,
        label: t('tasks.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [assigneeCount, linkedCount, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = TASK_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        const hasError = !isDisabled && tabHasError(tab.id);
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('tasks.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count !== null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
              {hasError ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                  aria-label={t('common.error', { defaultValue: 'Error' })}
                />
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon icon={CheckSquare} />
          </span>
          <div className="min-w-0 flex-1">
            <Input
              id="task-title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={t('tasks.titlePlaceholder')}
              aria-label={t('tasks.title')}
              className={cn(
                DETAIL_FORM_TITLE_INPUT_CLASS,
                PLUGIN_PAGE_TITLE_CLASS,
                'min-w-0 tracking-[0.003em]',
                getFieldError('title') && FORM_INPUT_ERROR_CLASS,
              )}
              required
            />
            {getFieldError('title') ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('title')?.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const informationCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('tasks.taskContent')} icon={FileText} subtleTitle className="p-6">
        <React.Suspense
          fallback={
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled
            />
          }
        >
          <RichTextEditor
            variant="ghost"
            value={formData.content}
            onChange={handleContentChange}
            placeholder={t('tasks.contentPlaceholder')}
            className={cn(getFieldError('content') && FORM_INPUT_ERROR_CLASS)}
          />
        </React.Suspense>
        {getFieldError('content') ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {getFieldError('content')?.message}
          </p>
        ) : null}
      </DetailSection>
    </Card>
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
            <TaskStatusSelect
              task={{ status: formData.status }}
              onStatusChange={(status) => updateField('status', status as TaskStatus)}
              hideInlineLabel
            />
          </div>
          <div className={DETAIL_PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('tasks.propertyPriority')}
            </span>
            <TaskPrioritySelect
              task={{ priority: formData.priority }}
              onPriorityChange={(priority) => updateField('priority', priority as TaskPriority)}
              hideInlineLabel
            />
          </div>
          <div className={DETAIL_PROP_ROW_CLASS}>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('tasks.propertyDueDate')}
            </span>
            <TaskDueDatePicker
              task={{ dueDate: formData.dueDate }}
              onDueDateChange={(date) => updateField('dueDate', date)}
              hideInlineLabel
            />
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  const assigneesCard = (
    <div className="space-y-4">
      <TaskAssigneeSelect
        task={{ assignedToIds: formData.assignedToIds }}
        onAssigneeChange={(ids) => updateField('assignedToIds', ids)}
      />
      {hasTeamsPlugin ? (
        <TaskAssignedTeamSelect
          task={{ teamId: formData.teamId }}
          onTeamChange={(teamId) => updateField('teamId', teamId)}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <div className="plugin-tasks">
        <DetailLayout gridClassName="grid-cols-1">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {formHeader}

            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm text-destructive font-medium">{t('common.cannotSave')}</div>
                <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
                  {validationErrors
                    .filter((error) => !error.message.includes('Warning'))
                    .map((error) => (
                      <li key={`${error.field}-${error.message}`}>{error.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            {activeTab === 'information' ? informationCard : null}

            {activeTab === 'information' ? propertiesCard : null}
            {activeTab === 'assignees' ? assigneesCard : null}
          </form>
        </DetailLayout>
      </div>

      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={currentTask ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </>
  );
});
