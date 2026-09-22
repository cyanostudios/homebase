import { Check, ChevronRight, Factory, Languages, MapPin, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_SELECT_CLASS,
  FORM_INPUT_ERROR_CLASS,
} from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
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

type GuideFormTab = 'details' | 'presentations' | 'review';

const GUIDE_FORM_TABS: GuideFormTab[] = ['details', 'presentations', 'review'];

/** Visible in edit for shell parity with View, but not selectable while editing. */
const GUIDE_FORM_EDIT_DISABLED_TABS: ReadonlySet<GuideFormTab> = new Set([
  'presentations',
  'review',
]);

function parseGuideFormTab(value: string | null): GuideFormTab {
  if (value && GUIDE_FORM_TABS.includes(value as GuideFormTab)) {
    return value as GuideFormTab;
  }
  return 'details';
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseGuideFormTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: GuideFormTab, replace = false) => {
      if (GUIDE_FORM_EDIT_DISABLED_TABS.has(tab)) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'details') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  // Presentations / Review stay visible (greyed) but are not editable here — production panel owns them.
  useEffect(() => {
    if (!GUIDE_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
      return;
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

  const { validationErrors, clearValidationErrors, panelMode, isSaving } = useGuides();
  const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
    useUnsavedChanges();
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

  // While create/edit is open, block list + sidebar navigation (same discard prompt as Close).
  useEffect(() => {
    const formKey = `guide-form-${currentItem?.id || 'new'}`;
    registerUnsavedChangesChecker(formKey, () => true);
    return () => unregisterUnsavedChangesChecker(formKey);
  }, [currentItem, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
    attemptAction(() => onCancel(), { force: true });
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

  const tabs = useMemo(
    () => [
      {
        id: 'details' as const,
        label: t('guides.tabs.details'),
        icon: MapPin,
      },
      {
        id: 'presentations' as const,
        label: t('guides.tabs.presentations'),
        icon: Languages,
      },
      {
        id: 'review' as const,
        label: t('guides.tabs.review'),
        icon: ChevronRight,
      },
    ],
    [t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isDisabled = GUIDE_FORM_EDIT_DISABLED_TABS.has(tab.id);
        const isActive = !isDisabled && activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={
              isDisabled
                ? t('guides.tabUnavailableInEdit', {
                    defaultValue: 'Available in view mode only',
                  })
                : undefined
            }
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              isDisabled && 'pointer-events-none opacity-40',
            )}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const guideTitle = currentItem?.displayName?.trim() || t('guides.addPlace');

  const formHeader = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
      <div className="px-4 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0" aria-hidden>
            <SectionCategoryIcon
              icon={MapPin}
              className="h-9 w-9 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 [&_svg]:h-4 [&_svg]:w-4"
            />
          </span>
          <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
            {guideTitle}
          </h3>
        </div>
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  return (
    <>
      <div className="plugin-guides">
        <DetailLayout gridClassName="grid-cols-1">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
          >
            {formHeader}

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

            {activeTab === 'details' ? (
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
                        className={cn(
                          FORM_GHOST_INPUT_CLASS,
                          getFieldError('displayName') && FORM_INPUT_ERROR_CLASS,
                        )}
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
                        className={cn(
                          FORM_GHOST_SELECT_CLASS,
                          getFieldError('lifecycleStatus') && FORM_INPUT_ERROR_CLASS,
                        )}
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
            ) : null}

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
