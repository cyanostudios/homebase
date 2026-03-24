import { Info, SlidersHorizontal } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { RichTextEditor } from '@/core/ui/RichTextEditor';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskSettingsForm } from './TaskSettingsForm';

const TASK_FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number];
type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];

interface TaskFormState {
  title: string;
  content: string;
  mentions: any[];
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignedToIds: string[];
}

interface TaskFormProps {
  currentTask?: any;
  onSave: (data: TaskFormState) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  currentTask,
  onSave,
  onCancel,
  isSubmitting: externalIsSubmitting = false,
}) => {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode } = useTasks();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
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
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  useEffect(() => {
    const formKey = `task-form-${currentTask?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentTask, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: [],
      status: 'not started',
      priority: 'Medium',
      dueDate: null,
      assignedToIds: [],
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
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  useEffect(() => {
    if (panelMode === 'settings') {
      return;
    }
    (window as any).submitTasksForm = handleSubmit;
    (window as any).cancelTasksForm = handleCancel;

    return () => {
      delete (window as any).submitTasksForm;
      delete (window as any).cancelTasksForm;
    };
  }, [handleSubmit, handleCancel, panelMode]);

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

  const handleDateChange = (dateString: string) => {
    const date = dateString ? new Date(dateString) : null;
    updateField('dueDate', date);
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  if (panelMode === 'settings') {
    return <TaskSettingsForm onCancel={onCancel} />;
  }

  const formatDateForInput = (date: Date | null) => {
    if (!date) {
      return '';
    }
    return date.toISOString().split('T')[0];
  };

  const formSidebar = currentTask ? (
    <div className="space-y-4">
      <Card padding="none" className={TASK_FORM_CARD_CLASS}>
        <DetailSection
          title={t('tasks.information')}
          icon={Info}
          iconPlugin="tasks"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('tasks', currentTask.id)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">
                {currentTask.createdAt ? new Date(currentTask.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Updated</span>
              <span className="font-medium">
                {currentTask.updatedAt ? new Date(currentTask.updatedAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <>
      <div
        className={cn(
          'plugin-tasks min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
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

            <Card padding="none" className={TASK_FORM_CARD_CLASS}>
              <DetailSection title={t('tasks.taskContent')} iconPlugin="tasks" className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="task-title" className="mb-1">
                      Title
                    </Label>
                    <Input
                      id="task-title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder={t('tasks.titlePlaceholder')}
                      className={getFieldError('title') ? 'border-red-500' : ''}
                      required
                    />
                    {getFieldError('title') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('title')?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="mb-1">Description</Label>
                    <RichTextEditor
                      value={formData.content}
                      onChange={handleContentChange}
                      placeholder={t('tasks.contentPlaceholder')}
                      className={getFieldError('content') ? 'border-red-500' : ''}
                    />
                    {getFieldError('content') && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {getFieldError('content')?.message}
                      </p>
                    )}
                  </div>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={TASK_FORM_CARD_CLASS}>
              <div className="space-y-2 p-6">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {t('tasks.taskProperties')}
                  </span>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Status</div>
                    <NativeSelect
                      id="task-status"
                      className="h-9 max-w-[180px] text-xs"
                      value={formData.status}
                      onChange={(e) => updateField('status', e.target.value as TaskStatus)}
                    >
                      {TASK_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Priority</div>
                    <NativeSelect
                      id="task-priority"
                      className="h-9 max-w-[180px] text-xs"
                      value={formData.priority}
                      onChange={(e) => updateField('priority', e.target.value as TaskPriority)}
                    >
                      {TASK_PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">Due Date</div>
                    <Input
                      id="task-due-date"
                      type="date"
                      className="h-9 max-w-[180px] text-xs"
                      value={formatDateForInput(formData.dueDate)}
                      onChange={(e) => handleDateChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <TaskAssigneeSelect
              task={{ assignedToIds: formData.assignedToIds }}
              onAssigneeChange={(ids) => updateField('assignedToIds', ids)}
            />
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
};
