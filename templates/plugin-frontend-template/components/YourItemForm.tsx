import { Info } from 'lucide-react';
import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItemPayload } from '../types/your-items';

import { YourItemSettingsForm } from './YourItemSettingsForm';

const FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[920px]';

interface YourItemFormProps {
  currentItem?: { id: string; title: string; description: string | null };
  onSave: (data: YourItemPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const YourItemForm = React.forwardRef<PanelFormHandle, YourItemFormProps>(function YourItemForm(
  { currentItem, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
  ref,
) {
  const { t } = useTranslation();
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
    } else if (panelMode !== 'settings') {
      resetForm();
    }
  }, [currentItem, panelMode, markClean, resetForm]);

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

  if (panelMode === 'settings') {
    return <YourItemSettingsForm ref={ref} onCancel={onCancel} />;
  }

  const updateField = (field: keyof YourItemPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const formSidebar = currentItem ? (
    <div className="space-y-4">
      <Card padding="none" className={FORM_CARD_CLASS}>
        <DetailSection title="Information" icon={Info} iconPlugin="your-items" className="p-4">
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('your-items', currentItem.id)}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
      <DetailActivityLog
        entityType="your_item"
        entityId={currentItem.id}
        title="Activity"
        refreshKey={currentItem.id}
      />
    </div>
  ) : undefined;

  return (
    <>
      <div
        className={cn(
          'plugin-your-items min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
          'md:-mx-6 md:-my-4 md:rounded-b-lg md:rounded-t-none',
        )}
      >
        <DetailLayout mainClassName={PANEL_MAX_WIDTH} sidebar={formSidebar}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {hasBlockingErrors && (
              <Card className="shadow-none border-destructive/50 bg-destructive/5 p-4">
                <div className="text-sm text-destructive font-medium">{t('common.cannotSave')}</div>
                <ul className="list-disc list-inside mt-2 text-sm text-destructive/90">
                  {validationErrors
                    .filter((e) => !e.message.includes('Warning'))
                    .map((e) => (
                      <li key={`${e.field}-${e.message}`}>{e.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            <Card padding="none" className={FORM_CARD_CLASS}>
              <DetailSection title="Details" iconPlugin="your-items" className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="your-item-title">Title</Label>
                    <Input
                      id="your-item-title"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="Enter a title"
                      className={cn(getFieldError('title') && 'border-destructive')}
                    />
                    {getFieldError('title') && (
                      <p className="mt-1 text-sm text-destructive">{getFieldError('title')?.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="your-item-description">Description</Label>
                    <Textarea
                      id="your-item-description"
                      value={formData.description ?? ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      rows={6}
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
});
