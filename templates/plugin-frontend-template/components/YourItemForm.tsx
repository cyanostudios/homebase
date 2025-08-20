// templates/plugin-frontend-template/components/YourItemForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useYourItems } from '../hooks/useYourItems';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

interface YourItemFormProps {
  currentItem?: any;
  onSave: (data: any) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const YourItemForm: React.FC<YourItemFormProps> = ({
  currentItem,
  onSave,
  onCancel,
  isSubmitting = false,
}) => {
  const { validationErrors, clearValidationErrors } = useYourItems();
  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } = useGlobalNavigationGuard();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  // Register unsaved-changes with global guard
  useEffect(() => {
    const formKey = `your-item-form-${currentItem?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentItem, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Load data for edit/view
  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title || '',
        description: currentItem.description || '',
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentItem, markClean]);

  const resetForm = useCallback(() => {
    setFormData({ title: '', description: '' });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    const ok = await onSave(formData);
    if (ok) {
      markClean();
      if (!currentItem) resetForm();
    }
  }, [formData, onSave, markClean, currentItem, resetForm]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  // Listen to global events dispatched by TemplateContext (PLURAL functions dispatch custom events)
  useEffect(() => {
    const onSubmit = () => handleSubmit();
    const onCancelEv = () => handleCancel();
    window.addEventListener('submitYourItemForm', onSubmit as EventListener);
    window.addEventListener('cancelYourItemForm', onCancelEv as EventListener);
    return () => {
      window.removeEventListener('submitYourItemForm', onSubmit as EventListener);
      window.removeEventListener('cancelYourItemForm', onCancelEv as EventListener);
    };
  }, [handleSubmit, handleCancel]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) =>
    validationErrors.find(err => err.field === field);

  const hasBlockingErrors = validationErrors.some(err => !err.message.includes('Warning'));

  const handleDiscardChanges = () => {
    if (!currentItem) {
      resetForm();
      setTimeout(() => confirmDiscard(), 0);
    } else {
      confirmDiscard();
    }
  };

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {/* Validation Summary */}
        {hasBlockingErrors && (
          <Card padding="sm" className="shadow-none px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800 font-medium">Cannot save item</div>
              <ul className="list-disc list-inside mt-2 text-sm text-red-700">
                {validationErrors
                  .filter(e => !e.message.includes('Warning'))
                  .map((e, i) => <li key={i}>{e.message}</li>)}
              </ul>
            </div>
          </Card>
        )}

        {/* Basic Fields */}
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3">Details</Heading>
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Enter a title"
                className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  getFieldError('title') ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {getFieldError('title') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                placeholder="Optional description…"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>
          </div>
        </Card>

        {/* Optional local buttons (panel usually provides Save/Cancel) */}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>Save</Button>
          <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
        </div>
      </form>

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={
          currentItem
            ? 'You have unsaved changes. Discard and return to view mode?'
            : 'You have unsaved changes. Discard and close the form?'
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
