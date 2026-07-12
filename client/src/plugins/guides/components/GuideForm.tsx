import { Check, Info, Languages, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout, PANEL_MAX_WIDTH } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useGuides } from '../hooks/useGuides';
import {
  GUIDE_LIFECYCLE_STATUSES,
  MASTER_GUIDE_EDITORIAL_STATUSES,
  type GuidePayload,
} from '../types/guides';

const FORM_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';

interface GuideFormProps {
  currentItem?: {
    id: string;
    displayName: string;
    shortIntro: string | null;
    geographicReference: string | null;
    lifecycleStatus: GuidePayload['lifecycleStatus'];
    sourceLanguage: string;
    masterGuideEditorialStatus: GuidePayload['masterGuideEditorialStatus'];
  };
  onSave: (data: GuidePayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const GuideForm = React.forwardRef<PanelFormHandle, GuideFormProps>(function GuideForm(
  { currentItem, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
  ref,
) {
  const { t } = useTranslation();
  const { validationErrors, clearValidationErrors, panelMode, isSaving } = useGuides();
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
  const [formData, setFormData] = useState<GuidePayload>({
    displayName: '',
    shortIntro: null,
    geographicReference: null,
    lifecycleStatus: 'draft',
    sourceLanguage: 'sv',
    masterGuideEditorialStatus: 'draft',
  });

  const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;
  const isCreateMode = !currentItem;

  useEffect(() => {
    const formKey = `guide-form-${currentItem?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => isDirty);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [isDirty, currentItem, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  const resetForm = useCallback(() => {
    setFormData({
      displayName: '',
      shortIntro: null,
      geographicReference: null,
      lifecycleStatus: 'draft',
      sourceLanguage: 'sv',
      masterGuideEditorialStatus: 'draft',
    });
    markClean();
  }, [markClean]);

  useEffect(() => {
    if (currentItem) {
      setFormData({
        displayName: currentItem.displayName,
        shortIntro: currentItem.shortIntro,
        geographicReference: currentItem.geographicReference,
        lifecycleStatus: currentItem.lifecycleStatus ?? 'draft',
        sourceLanguage: currentItem.sourceLanguage,
        masterGuideEditorialStatus: currentItem.masterGuideEditorialStatus ?? 'draft',
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentItem, markClean, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (isCurrentlySubmitting) return;
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

  const updateField = <K extends keyof GuidePayload>(field: K, value: GuidePayload[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    markDirty();
    clearValidationErrors();
  };

  const formSidebar = currentItem ? (
    <div className="space-y-4">
      <Card padding="none" className={FORM_CARD_CLASS}>
        <DetailSection
          title={t('guides.information')}
          icon={Info}
          iconPlugin="guides"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('guides.colId')}</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('guides', currentItem.id)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('guides.colSourceLanguage')}</span>
              <span className="uppercase">{currentItem.sourceLanguage}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('guides.masterGuideEditorialStatus')}
              </span>
              <span>
                {t(`guides.editorial.${currentItem.masterGuideEditorialStatus ?? 'draft'}`)}
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
          'plugin-guides min-h-full bg-background px-4 py-5 sm:px-5 sm:py-6 rounded-xl',
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
                <div className="text-sm font-medium text-destructive">{t('common.cannotSave')}</div>
                <ul className="mt-2 list-inside list-disc text-sm text-destructive/90">
                  {validationErrors
                    .filter((e) => !e.message.includes('Warning'))
                    .map((e) => (
                      <li key={`${e.field}-${e.message}`}>{e.message}</li>
                    ))}
                </ul>
              </Card>
            )}

            <Card padding="none" className={FORM_CARD_CLASS}>
              <DetailSection title={t('guides.details')} iconPlugin="guides" className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="guide-display-name">{t('guides.displayName')}</Label>
                    <Input
                      id="guide-display-name"
                      value={formData.displayName}
                      onChange={(e) => updateField('displayName', e.target.value)}
                      placeholder={t('guides.displayNamePlaceholder')}
                      className={cn(getFieldError('displayName') && 'border-destructive')}
                    />
                    {getFieldError('displayName') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('displayName')?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="guide-short-intro">{t('guides.shortIntro')}</Label>
                    <Textarea
                      id="guide-short-intro"
                      value={formData.shortIntro ?? ''}
                      onChange={(e) => updateField('shortIntro', e.target.value || null)}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="guide-geographic-reference">
                      {t('guides.geographicReference')}
                    </Label>
                    <Input
                      id="guide-geographic-reference"
                      value={formData.geographicReference ?? ''}
                      onChange={(e) => updateField('geographicReference', e.target.value || null)}
                      placeholder={t('guides.geographicReferencePlaceholder')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="guide-lifecycle-status">{t('guides.lifecycleStatus')}</Label>
                    <NativeSelect
                      id="guide-lifecycle-status"
                      value={formData.lifecycleStatus ?? 'draft'}
                      onChange={(e) =>
                        updateField(
                          'lifecycleStatus',
                          e.target.value as GuidePayload['lifecycleStatus'],
                        )
                      }
                    >
                      {GUIDE_LIFECYCLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`guides.lifecycle.${status}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={FORM_CARD_CLASS}>
              <DetailSection
                title={t('guides.masterGuide')}
                icon={Languages}
                iconPlugin="guides"
                className="p-6"
              >
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="guide-source-language">{t('guides.sourceLanguage')}</Label>
                    <Input
                      id="guide-source-language"
                      value={formData.sourceLanguage ?? 'sv'}
                      onChange={(e) => updateField('sourceLanguage', e.target.value.toLowerCase())}
                      placeholder={t('guides.sourceLanguagePlaceholder')}
                      className={cn(getFieldError('sourceLanguage') && 'border-destructive')}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('guides.sourceLanguageHint')}
                    </p>
                    {getFieldError('sourceLanguage') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('sourceLanguage')?.message}
                      </p>
                    )}
                  </div>

                  {!isCreateMode && (
                    <div>
                      <Label htmlFor="guide-editorial-status">
                        {t('guides.masterGuideEditorialStatus')}
                      </Label>
                      <NativeSelect
                        id="guide-editorial-status"
                        value={formData.masterGuideEditorialStatus ?? 'draft'}
                        onChange={(e) =>
                          updateField(
                            'masterGuideEditorialStatus',
                            e.target.value as GuidePayload['masterGuideEditorialStatus'],
                          )
                        }
                      >
                        {MASTER_GUIDE_EDITORIAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`guides.editorial.${status}`)}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </div>
              </DetailSection>
            </Card>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                onClick={handleCancel}
                disabled={isCurrentlySubmitting}
                className="h-9 px-3 text-xs"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Check}
                onClick={() => void handleSubmit()}
                disabled={hasBlockingErrors || isCurrentlySubmitting}
                className="h-9 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-none"
              >
                {isCurrentlySubmitting
                  ? t('common.saving')
                  : panelMode === 'edit'
                    ? t('common.update')
                    : t('common.save')}
              </Button>
            </div>
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
