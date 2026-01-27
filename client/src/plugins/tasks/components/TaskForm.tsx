import React, { useState, useEffect, useCallback } from 'react';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useTasks } from '../hooks/useTasks';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

import { MentionTextarea } from './MentionTextarea';

type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number];
type TaskPriority = (typeof TASK_PRIORITY_OPTIONS)[number];

interface TaskFormState {
  title: string;
  content: string;
  mentions: any[]; // ersätt gärna med er Mention-typ om ni har en
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assignedTo: string | null;
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
  const { validationErrors, clearValidationErrors } = useTasks();
  const { contacts } = useApp();
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
    assignedTo: null,
  });

  // Use internal state or external prop (external takes precedence)
  const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

  // Register this form's unsaved changes state globally
  useEffect(() => {
    const formKey = `task-form-${currentTask?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);

    return () => {
      unregisterUnsavedChangesChecker(formKey);
    };
  }, [isDirty, currentTask, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load currentTask data when editing
  useEffect(() => {
    if (currentTask) {
      setFormData({
        title: currentTask.title || '',
        content: currentTask.content || '',
        mentions: currentTask.mentions || [],
        status: (currentTask.status as TaskStatus) || 'not started',
        priority: (currentTask.priority as TaskPriority) || 'Medium',
        dueDate: currentTask.dueDate || null,
        assignedTo: currentTask.assignedTo || null,
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentTask, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: [],
      status: 'not started',
      priority: 'Medium',
      dueDate: null,
      assignedTo: null,
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) {
      return;
    } // Prevent double submission

    setIsSubmitting(true);
    try {
      console.log('Form submitting with data:', formData);
      console.log('Current validation errors:', validationErrors);
      const success = await onSave(formData);
      console.log('Save result:', success);
      if (success) {
        markClean();
        if (!currentTask) {
          resetForm();
        }
      } else {
        console.log('Save failed due to validation errors');
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    onSave,
    markClean,
    currentTask,
    resetForm,
    validationErrors,
    isCurrentlySubmitting,
  ]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions with correct plural naming
  useEffect(() => {
    (window as any).submitTasksForm = handleSubmit; // PLURAL!
    (window as any).cancelTasksForm = handleCancel; // PLURAL!

    return () => {
      delete (window as any).submitTasksForm;
      delete (window as any).cancelTasksForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentTask) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
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

  // Helper function to get error for a specific field
  const getFieldError = (fieldName: string) => {
    return validationErrors.find((error) => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some((error) => !error.message.includes('Warning'));

  // Format date for input field
  const formatDateForInput = (date: Date | null) => {
    if (!date) {
      return '';
    }
    return date.toISOString().split('T')[0];
  };

  // Get assignable contacts (for now, all contacts)
  const assignableContacts = contacts;

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400 dark:text-red-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                    Cannot save task
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter((error) => !error.message.includes('Warning'))
                        .map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Task Title */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Task Title
          </Heading>
          <div>
            <Label htmlFor="task-title" className="mb-1">
              Title
            </Label>
            <Input
              id="task-title"
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter task title..."
              className={getFieldError('title') ? 'border-red-500' : ''}
              required
            />
            {getFieldError('title') && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('title')?.message}
              </p>
            )}
          </div>
        </Card>

        {/* Task Status and Priority */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Task Details
          </Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <Label htmlFor="task-status" className="mb-1">
                Status
              </Label>
              <NativeSelect
                id="task-status"
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

            {/* Priority */}
            <div>
              <Label htmlFor="task-priority" className="mb-1">
                Priority
              </Label>
              <NativeSelect
                id="task-priority"
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
        </Card>

        {/* Due Date and Assignment */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Scheduling
          </Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <Label htmlFor="task-due-date" className="mb-1">
                Due Date
              </Label>
              <Input
                id="task-due-date"
                type="date"
                value={formatDateForInput(formData.dueDate)}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            {/* Assigned To */}
            <div>
              <Label htmlFor="task-assigned-to" className="mb-1">
                Assigned To
              </Label>
              <NativeSelect
                id="task-assigned-to"
                value={formData.assignedTo || ''}
                onChange={(e) => updateField('assignedTo', e.target.value || null)}
              >
                <option value="">Not assigned</option>
                {assignableContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.companyName}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </Card>

        {/* Task Content with @mentions */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">
            Task Description
          </Heading>
          <div>
            <Label htmlFor="task-description" className="mb-1">
              Description{' '}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (Type @ to mention contacts)
              </span>
            </Label>
            <MentionTextarea
              value={formData.content}
              onChange={handleContentChange}
              placeholder="Describe the task details... Type @ to mention contacts"
              rows={8}
              className={getFieldError('content') ? 'border-red-500' : ''}
            />
            {getFieldError('content') && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {getFieldError('content')?.message}
              </p>
            )}

            {/* Show mentions preview */}
            {formData.mentions.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs">
                <span className="font-medium text-blue-800 dark:text-blue-400">Mentions:</span>{' '}
                {formData.mentions.map((mention: any, index: number) => (
                  <span key={index} className="text-blue-600 dark:text-blue-400">
                    @{mention.contactName}
                    {index < formData.mentions.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </form>

      {/* Unsaved Changes Warning Dialog */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={
          currentTask
            ? 'You have unsaved changes. Do you want to discard your changes and return to view mode?'
            : 'You have unsaved changes. Do you want to discard your changes and close the form?'
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
