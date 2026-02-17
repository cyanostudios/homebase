// templates/plugin-frontend-template/components/YourItemForm.tsx
// Uses DetailSection and standard form controls. When panelMode === 'settings',
// renders YourItemSettingsForm; Close/Save work because we register listeners before the return.
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useYourItems } from '../hooks/useYourItems';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { YourItemSettingsForm } from './YourItemSettingsForm';

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
  const { validationErrors, clearValidationErrors, panelMode } = useYourItems();
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

  // Load data for edit
  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title || '',
        description: currentItem.description || '',
      });
      markClean();
    } else if (panelMode !== 'settings') {
      setFormData({ title: '', description: '' });
      markClean();
    }
  }, [currentItem, panelMode, markClean]);

  const resetForm = useCallback(() => {
    setFormData({ title: '', description: '' });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (panelMode === 'settings') {
      onCancel();
      return;
    }
    const ok = await onSave(formData);
    if (ok) {
      markClean();
      if (!currentItem) resetForm();
    }
  }, [panelMode, formData, onSave, onCancel, markClean, currentItem, resetForm]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  // Register listeners before any early return so Close/Save work in settings mode too
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

  // Settings mode: render settings form; footer Close/Save still trigger the listeners above
  if (panelMode === 'settings') {
    return <YourItemSettingsForm onCancel={onCancel} />;
  }

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);

  const hasBlockingErrors = validationErrors.some((err) => !err.message.includes('Warning'));

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
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        {hasBlockingErrors && (
          <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
            <div className="text-sm text-destructive font-medium">Cannot save item</div>
            <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
              {validationErrors
                .filter((e) => !e.message.includes('Warning'))
                .map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
            </ul>
          </Card>
        )}

        <DetailSection title="Details">
          <div className="space-y-3 grid grid-cols-1 md:grid-cols-2 md:gap-3">
            <div className="space-y-2">
              <Label htmlFor="your-item-title">Title</Label>
              <Input
                id="your-item-title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Enter a title"
                className={cn(getFieldError('title') && 'border-destructive')}
              />
              {getFieldError('title') && (
                <p className="text-sm text-destructive">{getFieldError('title')?.message}</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="your-item-description">Description</Label>
              <textarea
                id="your-item-description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                placeholder="Optional description…"
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:ring-2 focus:ring-ring focus:border-ring resize-y"
              />
            </div>
          </div>
        </DetailSection>

        <div className="flex gap-2">
          <Button type="submit" variant="default" disabled={isSubmitting}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>

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
