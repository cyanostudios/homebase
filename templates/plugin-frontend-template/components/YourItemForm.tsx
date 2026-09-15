/**
 * Detail form — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/contacts/components/ContactForm.tsx.
 */
import { FileText } from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import {
  FORM_INPUT_CLASS,
  FORM_INPUT_ERROR_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItemPayload } from '../types/your-items';

interface YourItemFormProps {
  currentItem?: {
    id: string;
    title: string;
    description: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  onSave: (data: YourItemPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Single-column stack in list mail-layout aside. */
  stacked?: boolean;
}

export const YourItemForm = React.forwardRef<PanelFormHandle, YourItemFormProps>(
  function YourItemForm(
    {
      currentItem,
      onSave,
      onCancel,
      isSubmitting: externalIsSubmitting = false,
      stacked: _stacked = false,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const { validationErrors, clearValidationErrors, isSaving } = useYourItems();
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
    const [formData, setFormData] = useState<YourItemPayload>({
      title: '',
      description: null,
    });

    const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;

    useEffect(() => {
      const formKey = `your-item-form-${currentItem?.id || 'new'}`;
      registerUnsavedChangesChecker(formKey, () => isDirty);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [isDirty, currentItem, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    const resetForm = useCallback(() => {
      setFormData({ title: '', description: null });
      markClean();
    }, [markClean]);

    useEffect(() => {
      if (currentItem) {
        setFormData({
          title: currentItem.title,
          description: currentItem.description,
        });
        markClean();
      } else {
        resetForm();
      }
    }, [currentItem, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await onSave(formData);
        if (ok) {
          markClean();
          if (!currentItem) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [formData, onSave, markClean, currentItem, resetForm, isCurrentlySubmitting]);

    const handleCancel = useCallback(() => {
      attemptAction(() => onCancel());
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
      if (!currentItem) {
        resetForm();
        setTimeout(() => confirmDiscard(), 0);
      } else {
        confirmDiscard();
        onCancel();
      }
    };

    const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

    const updateField = (field: keyof YourItemPayload, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      markDirty();
      clearValidationErrors();
    };

    return (
      <>
        <div className="plugin-your-items">
          <DetailLayout gridClassName="grid-cols-1">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              {hasBlockingErrors && (
                <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
                  <div className="text-sm font-medium text-destructive">
                    {t('common.cannotSave')}
                  </div>
                  <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                    {validationErrors
                      .filter((e) => !e.message.includes('Warning'))
                      .map((e) => (
                        <li key={`${e.field}-${e.message}`}>{e.message}</li>
                      ))}
                  </ul>
                </Card>
              )}

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title="Details" icon={FileText} iconPlugin="your-items" className="p-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="your-item-title">Title</Label>
                      <Input
                        id="your-item-title"
                        value={formData.title}
                        onChange={(e) => updateField('title', e.target.value)}
                        placeholder="Enter a title"
                        className={cn(
                          FORM_INPUT_CLASS,
                          getFieldError('title') && FORM_INPUT_ERROR_CLASS,
                        )}
                      />
                      {getFieldError('title') && (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('title')?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="your-item-description">Description</Label>
                      <Textarea
                        id="your-item-description"
                        value={formData.description ?? ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        rows={6}
                        className={FORM_TEXTAREA_CLASS}
                      />
                    </div>
                  </div>
                </DetailSection>
              </Card>
            </form>
          </DetailLayout>
        </div>

        <ConfirmDialog
          isOpen={showWarning}
          title={t('dialog.unsavedChanges')}
          message={currentItem ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
          confirmText={t('common.discard')}
          cancelText={t('common.continueEditing')}
          onConfirm={handleDiscardChanges}
          onCancel={cancelDiscard}
          variant="warning"
        />
      </>
    );
  },
);
