import { Check, Factory, Info, MapPin, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import type { GuideSaveOptions } from '../context/GuidesContext';
import { useGuides } from '../hooks/useGuides';
import {
  GUIDE_LIFECYCLE_STATUSES,
  SUGGESTED_GUIDE_LANGUAGES,
  type GuidePayload,
  type PlaceResolved,
} from '../types/guides';

import { PlaceSearchField } from './PlaceSearchField';

interface GuideFormProps {
  currentItem?: {
    id: string;
    displayName: string;
    shortIntro: string | null;
    geographicReference: string | null;
    place?: PlaceResolved | null;
    lifecycleStatus: GuidePayload['lifecycleStatus'];
    sourceLanguage: string;
    masterGuideEditorialStatus: GuidePayload['masterGuideEditorialStatus'];
  };
  onSave: (data: GuidePayload, options?: GuideSaveOptions) => Promise<boolean> | boolean;
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
    place: null,
    lifecycleStatus: 'draft',
    sourceLanguage: 'en',
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
      place: null,
      lifecycleStatus: 'draft',
      sourceLanguage: 'en',
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
        place: currentItem.place ?? null,
        lifecycleStatus: currentItem.lifecycleStatus ?? 'draft',
        sourceLanguage: currentItem.sourceLanguage,
        masterGuideEditorialStatus: currentItem.masterGuideEditorialStatus ?? 'draft',
      });
      markClean();
    } else {
      resetForm();
    }
  }, [currentItem, markClean, resetForm]);

  const handleSubmit = useCallback(
    async (options?: GuideSaveOptions) => {
      if (isCurrentlySubmitting) return;
      setIsSubmitting(true);
      try {
        const ok = await onSave(formData, options);
        if (ok) {
          markClean();
          if (!currentItem) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onSave, markClean, currentItem, resetForm, isCurrentlySubmitting],
  );

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
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('guides.information.title')}
          icon={Info}
          iconPlugin="guides"
          className="p-4"
          collapsible
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('guides.colId')}</span>
              <span className="font-mono font-medium">
                {formatDisplayNumber('guides', currentItem.id)}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <>
      <div className="plugin-guides">
        <DetailLayout sidebar={formSidebar}>
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

            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('guides.details')}
                icon={MapPin}
                iconPlugin="guides"
                className="p-6"
              >
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
                    <Label htmlFor="guide-place">{t('guides.place.label')}</Label>
                    <div id="guide-place" className="mt-1">
                      <PlaceSearchField
                        value={formData.place ?? null}
                        geographicReferenceFallback={
                          formData.place ? null : formData.geographicReference
                        }
                        disabled={isCurrentlySubmitting}
                        onChange={(place, geographicReference) => {
                          setFormData((prev) => ({
                            ...prev,
                            place,
                            geographicReference,
                          }));
                          markDirty();
                          clearValidationErrors();
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label id="guide-source-language-label">{t('guides.sourceLanguage')}</Label>
                    <div
                      role="radiogroup"
                      aria-labelledby="guide-source-language-label"
                      className="mt-2 flex flex-wrap gap-2"
                    >
                      {(SUGGESTED_GUIDE_LANGUAGES.includes(
                        (formData.sourceLanguage ?? 'en').toLowerCase(),
                      )
                        ? SUGGESTED_GUIDE_LANGUAGES
                        : [
                            (formData.sourceLanguage ?? 'en').toLowerCase(),
                            ...SUGGESTED_GUIDE_LANGUAGES,
                          ]
                      ).map((code) => {
                        const selected = (formData.sourceLanguage ?? 'en').toLowerCase() === code;
                        return (
                          <label
                            key={code}
                            className={cn(
                              'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50',
                              isCurrentlySubmitting && 'pointer-events-none opacity-60',
                              getFieldError('sourceLanguage') &&
                                !selected &&
                                'border-destructive/50',
                            )}
                          >
                            <input
                              type="radio"
                              name="guide-source-language"
                              className="sr-only"
                              checked={selected}
                              disabled={isCurrentlySubmitting}
                              onChange={() => updateField('sourceLanguage', code)}
                            />
                            <span className="font-semibold uppercase">{code}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('guides.sourceLanguageHint')}
                    </p>
                    {getFieldError('sourceLanguage') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('sourceLanguage')?.message}
                      </p>
                    )}
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
                      className={cn(getFieldError('lifecycleStatus') && 'border-destructive')}
                    >
                      {GUIDE_LIFECYCLE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`guides.lifecycle.${status}`)}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('guides.lifecycleActiveHint')}
                    </p>
                    {getFieldError('lifecycleStatus') && (
                      <p className="mt-1 text-sm text-destructive">
                        {getFieldError('lifecycleStatus')?.message}
                      </p>
                    )}
                  </div>
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
                variant={isCreateMode ? 'secondary' : 'primary'}
                size="sm"
                icon={Check}
                onClick={() => void handleSubmit()}
                disabled={hasBlockingErrors || isCurrentlySubmitting}
                className={cn(
                  'h-9 px-3 text-xs',
                  !isCreateMode && 'bg-green-600 hover:bg-green-700 text-white border-none',
                )}
              >
                {isCurrentlySubmitting
                  ? t('common.saving')
                  : panelMode === 'edit'
                    ? t('common.update')
                    : t('common.save')}
              </Button>
              {isCreateMode && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Factory}
                  onClick={() => void handleSubmit({ produce: true })}
                  disabled={hasBlockingErrors || isCurrentlySubmitting}
                  className="h-9 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-none"
                >
                  {isCurrentlySubmitting ? t('common.saving') : t('guides.saveAndProduce')}
                </Button>
              )}
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
