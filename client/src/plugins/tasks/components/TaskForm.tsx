import React, { useState, useEffect, useCallback } from 'react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useTasks } from '../hooks/useTasks';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useApp } from '@/core/api/AppContext';
import { MentionTextarea } from './MentionTextarea';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

interface TaskFormProps {
  currentTask?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  currentTask, 
  onSave, 
  onCancel, 
  isSubmitting = false 
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
    cancelDiscard 
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } = useGlobalNavigationGuard();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mentions: [],
    status: 'not started' as const,
    priority: 'Medium' as const,
    dueDate: null as Date | null,
    assignedTo: null as string | null,
  });

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
      // Edit mode - load existing data
      setFormData({
        title: currentTask.title || '',
        content: currentTask.content || '',
        mentions: currentTask.mentions || [],
        status: currentTask.status || 'not started',
        priority: currentTask.priority || 'Medium',
        dueDate: currentTask.dueDate || null,
        assignedTo: currentTask.assignedTo || null,
      });
      markClean();
    } else {
      // Create mode - reset to empty form
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
    console.log('Form submitting with data:', formData);
    console.log('Current validation errors:', validationErrors);
    const success = await onSave(formData);
    console.log('Save result:', success);
    if (success) {
      markClean();
      if (!currentTask) {
        resetForm();
      }
    }
    if (!success) {
      console.log('Save failed due to validation errors');
    }
  }, [formData, onSave, markClean, currentTask, resetForm, validationErrors]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions with correct plural naming
  useEffect(() => {
    window.submitTasksForm = handleSubmit; // PLURAL!
    window.cancelTasksForm = handleCancel; // PLURAL!
    
    return () => {
      delete window.submitTasksForm;
      delete window.cancelTasksForm;
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
    setFormData(prev => ({ ...prev, content, mentions }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      clearValidationErrors();
    }
    
    markDirty();
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation errors when user starts typing
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
    return validationErrors.find(error => error.field === fieldName);
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some(error => !error.message.includes('Warning'));

  // Format date for input field
  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Get assignable contacts (for now, all contacts - can be filtered later)
  const assignableContacts = contacts;

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Cannot save task
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Please fix the following errors before saving:</p>
                    <ul className="list-disc list-inside mt-1">
                      {validationErrors
                        .filter(error => !error.message.includes('Warning'))
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
          <Heading level={3} className="mb-3">Task Title</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Enter task title..."
              className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('title') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('title') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
            )}
          </div>
        </Card>

        {/* Task Status and Priority */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Task Details</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TASK_STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TASK_PRIORITY_OPTIONS.map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Due Date and Assignment */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Scheduling</Heading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formatDateForInput(formData.dueDate)}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To
              </label>
              <select
                value={formData.assignedTo || ''}
                onChange={(e) => updateField('assignedTo', e.target.value || null)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Not assigned</option>
                {assignableContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Task Content with @mentions */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Task Description</Heading>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-xs text-gray-500">(Type @ to mention contacts)</span>
            </label>
            <MentionTextarea
              value={formData.content}
              onChange={handleContentChange}
              placeholder="Describe the task details... Type @ to mention contacts"
              rows={8}
              className={getFieldError('content') ? 'border-red-500' : ''}
            />
            {getFieldError('content') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('content')?.message}</p>
            )}
            
            {/* Show mentions preview */}
            {formData.mentions.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                <span className="font-medium text-blue-800">Mentions:</span>{' '}
                {formData.mentions.map((mention: any, index: number) => (
                  <span key={index} className="text-blue-600">
                    @{mention.contactName}{index < formData.mentions.length - 1 ? ', ' : ''}
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
        message={currentTask 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
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