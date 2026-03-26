import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { DetailSection } from '@/core/ui/DetailSection';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useYourItems } from '../hooks/useYourItems';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import type { YourItemPayload } from '../types/your-items';

import { YourItemSettingsForm } from './YourItemSettingsForm';

interface YourItemFormProps {
  currentItem?: { id: string; title: string; description: string | null };
  onSave: (data: YourItemPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
}

export const YourItemForm: React.FC<YourItemFormProps> = ({ currentItem, onSave, onCancel }) => {
  const { validationErrors, clearValidationErrors, panelMode, isSaving } = useYourItems();
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

  const [formData, setFormData] = useState<YourItemPayload>({
    title: '',
    description: null,
  });
  useEffect(() => {
    const formKey = `your-item-form-${currentItem?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentItem, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title,
        description: currentItem.description,
      });
      markClean();
    } else if (panelMode !== 'settings') {
      setFormData({ title: '', description: null });
      markClean();
    }
  }, [currentItem, panelMode, markClean]);

  const resetForm = useCallback(() => {
    setFormData({ title: '', description: null });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (isSaving) {
      return;
    }
    const ok = await onSave(formData);
    if (ok) {
      markClean();
      if (!currentItem) resetForm();
    }
  }, [formData, onSave, markClean, currentItem, resetForm, isSaving]);

  const handleCancel = useCallback(() => {
    attemptAction(() => onCancel());
  }, [attemptAction, onCancel]);

  useEffect(() => {
    window.submitYourItemsForm = () => {
      void handleSubmit();
    };
    window.cancelYourItemsForm = () => {
      handleCancel();
    };
    window.submitYourItemForm = () => {
      void handleSubmit();
    };
    window.cancelYourItemForm = () => {
      handleCancel();
    };
    return () => {
      delete window.submitYourItemsForm;
      delete window.cancelYourItemsForm;
      delete window.submitYourItemForm;
      delete window.cancelYourItemForm;
    };
  }, [handleSubmit, handleCancel]);

  if (panelMode === 'settings') {
    return <YourItemSettingsForm onCancel={onCancel} />;
  }

  const updateField = (field: keyof YourItemPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);

  const hasBlockingErrors = validationErrors.length > 0;

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
          </div>
        </DetailSection>
        <DetailSection title="Description">
          <Textarea
            value={formData.description ?? ''}
            onChange={(e) => updateField('description', e.target.value)}
            rows={6}
          />
        </DetailSection>
      </form>

      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved changes"
        message={
          currentItem
            ? 'You have unsaved changes. Discard and return to view mode?'
            : 'You have unsaved changes. Discard and close the form?'
        }
        confirmText="Discard changes"
        cancelText="Continue editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
