import { FileText, History, Info } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  FORM_INPUT_ERROR_CLASS,
  FORM_GHOST_TEXTAREA_CLASS,
} from '@/core/ui/formFieldStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useIngest } from '../hooks/useIngest';
import type { IngestFetchMethod, IngestSource, IngestSourceType } from '../types/ingest';

const ALLOWED_SOURCE_TYPES: IngestSourceType[] = ['html', 'pdf', 'json', 'xml', 'other'];
function normalizeSourceType(value: string | undefined): IngestSourceType {
  if (value && ALLOWED_SOURCE_TYPES.includes(value as IngestSourceType)) {
    return value as IngestSourceType;
  }
  return 'other';
}

function normalizeFetchMethod(value: string | undefined): IngestFetchMethod {
  return value === 'browser_fetch' ? 'browser_fetch' : 'generic_http';
}

interface IngestSourceFormProps {
  currentIngest?: IngestSource | null;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Single-column layout for mail detail column. */
  stacked?: boolean;
}

type IngestFormTab = 'information' | 'excerpt' | 'runs' | 'activity';

const INGEST_FORM_TABS: IngestFormTab[] = ['information', 'excerpt', 'runs', 'activity'];

const INGEST_FORM_EDIT_DISABLED_TABS: ReadonlySet<IngestFormTab> = new Set([
  'excerpt',
  'runs',
  'activity',
]);

function parseIngestFormTab(value: string | null): IngestFormTab {
  if (value && INGEST_FORM_TABS.includes(value as IngestFormTab)) {
    return value as IngestFormTab;
  }
  return 'information';
}

export const IngestSourceForm = React.forwardRef<PanelFormHandle, IngestSourceFormProps>(
  function IngestSourceForm(
    {
      currentIngest,
      onSave,
      onCancel,
      isSubmitting: externalIsSubmitting = false,
      stacked: _stacked = false,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseIngestFormTab(searchParams.get('tab'));
    const setActiveTab = useCallback(
      (tab: IngestFormTab, replace = false) => {
        if (INGEST_FORM_EDIT_DISABLED_TABS.has(tab)) {
          return;
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (tab === 'information') {
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

    useEffect(() => {
      if (!INGEST_FORM_EDIT_DISABLED_TABS.has(activeTab)) {
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

    const { validationErrors, clearValidationErrors } = useIngest();
    const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
      useUnsavedChanges();
    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
      name: '',
      sourceUrl: '',
      sourceType: 'other' as IngestSourceType,
      fetchMethod: 'generic_http' as IngestFetchMethod,
      isActive: true,
      notes: '',
    });

    const isCurrentlySubmitting = externalIsSubmitting || isSubmitting;

    useEffect(() => {
      const key = `ingest-form-${currentIngest?.id || 'new'}`;
      registerUnsavedChangesChecker(key, () => true);
      return () => unregisterUnsavedChangesChecker(key);
    }, [currentIngest, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    const resetForm = useCallback(() => {
      setFormData({
        name: '',
        sourceUrl: '',
        sourceType: 'other',
        fetchMethod: 'generic_http',
        isActive: true,
        notes: '',
      });
      markClean();
    }, [markClean]);

    useEffect(() => {
      if (currentIngest) {
        setFormData({
          name: currentIngest.name || '',
          sourceUrl: currentIngest.sourceUrl || '',
          sourceType: normalizeSourceType(currentIngest.sourceType),
          fetchMethod: normalizeFetchMethod(currentIngest.fetchMethod),
          isActive: currentIngest.isActive !== false,
          notes: currentIngest.notes || '',
        });
        markClean();
      } else {
        resetForm();
      }
    }, [currentIngest, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const success = await onSave({
          ...formData,
          notes: formData.notes.trim() || null,
        });
        if (success) {
          markClean();
          if (!currentIngest) {
            resetForm();
          }
        }
      } catch (e) {
        console.error('Save failed:', e);
      } finally {
        setIsSubmitting(false);
      }
    }, [formData, onSave, markClean, currentIngest, resetForm, isCurrentlySubmitting]);

    const handleCancel = useCallback(() => {
      attemptAction(
        () => {
          onCancel();
        },
        { force: true },
      );
    }, [attemptAction, onCancel]);

    const handleDiscardChanges = useCallback(() => {
      if (!currentIngest) {
        resetForm();
        setTimeout(() => {
          confirmDiscard();
        }, 0);
      } else {
        confirmDiscard();
        onCancel();
      }
    }, [currentIngest, confirmDiscard, onCancel, resetForm]);

    useImperativeHandle(
      ref,
      () => ({
        submit: () => handleSubmit(),
        cancel: handleCancel,
      }),
      [handleSubmit, handleCancel],
    );

    const updateField = (field: string, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      markDirty();
      clearValidationErrors();
    };

    const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

    const tabs = useMemo(
      () => [
        { id: 'information' as const, label: t('ingest.tabs.information'), icon: Info },
        { id: 'excerpt' as const, label: t('ingest.tabs.excerpt'), icon: FileText },
        { id: 'runs' as const, label: t('ingest.tabs.runs'), icon: History },
        { id: 'activity' as const, label: t('ingest.tabs.activity'), icon: History },
      ],
      [t],
    );

    const tabChips = (
      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isDisabled = INGEST_FORM_EDIT_DISABLED_TABS.has(tab.id);
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
                  ? t('ingest.tabUnavailableInEdit', {
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

    const formHeader = (
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
        <div className="px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex shrink-0" aria-hidden>
              <SectionCategoryIcon icon={Info} />
            </span>
            <div className="min-w-0 flex-1">
              <Input
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder={t('ingest.namePlaceholder')}
                aria-label={t('ingest.name')}
                className={FORM_GHOST_INPUT_CLASS}
              />
            </div>
          </div>
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
    );

    return (
      <>
        <div className="plugin-ingest">
          <DetailLayout gridClassName="grid-cols-1">
            <div className="space-y-6">
              {formHeader}

              {validationErrors
                .filter((e) => e.field === 'general')
                .map((e) => (
                  <Card
                    key={e.message}
                    className="border-destructive/50 bg-destructive/5 p-4 shadow-none"
                  >
                    <p className="text-sm text-destructive">{e.message}</p>
                  </Card>
                ))}

              {activeTab === 'information' ? (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                  <DetailSection
                    title={t('ingest.sectionDetails')}
                    icon={Info}
                    iconPlugin="ingest"
                    className="p-6"
                  >
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="ingest-name">{t('ingest.name')}</Label>
                        <Input
                          id="ingest-name"
                          value={formData.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder={t('ingest.namePlaceholder')}
                          className={cn(
                            'mt-1',
                            FORM_GHOST_INPUT_CLASS,
                            getFieldError('name') && FORM_INPUT_ERROR_CLASS,
                          )}
                        />
                        {getFieldError('name') && (
                          <p className="mt-1 text-xs text-destructive">
                            {getFieldError('name')?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="ingest-url">{t('ingest.sourceUrl')}</Label>
                        <Input
                          id="ingest-url"
                          value={formData.sourceUrl}
                          onChange={(e) => updateField('sourceUrl', e.target.value)}
                          placeholder="https://"
                          className={cn(
                            'mt-1 font-mono',
                            FORM_GHOST_INPUT_CLASS,
                            getFieldError('sourceUrl') && FORM_INPUT_ERROR_CLASS,
                          )}
                        />
                        {getFieldError('sourceUrl') && (
                          <p className="mt-1 text-xs text-destructive">
                            {getFieldError('sourceUrl')?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>{t('ingest.sourceType')}</Label>
                        <Select
                          value={formData.sourceType}
                          onValueChange={(v) => updateField('sourceType', v as IngestSourceType)}
                        >
                          <SelectTrigger className={cn('mt-1', FORM_GHOST_INPUT_CLASS)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="html">HTML</SelectItem>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="xml">XML</SelectItem>
                            <SelectItem value="other">{t('ingest.typeOther')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t('ingest.fetchMethod')}</Label>
                        <Select
                          value={formData.fetchMethod}
                          onValueChange={(v) => updateField('fetchMethod', v as IngestFetchMethod)}
                        >
                          <SelectTrigger
                            id="ingest-fetch-method"
                            className={cn('mt-1', FORM_GHOST_INPUT_CLASS)}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="generic_http">
                              {t('ingest.fetchMethodGeneric')}
                            </SelectItem>
                            <SelectItem value="browser_fetch">
                              {t('ingest.fetchMethodBrowser')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {getFieldError('fetchMethod') && (
                          <p className="mt-1 text-xs text-destructive">
                            {getFieldError('fetchMethod')?.message}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('ingest.fetchMethodHint')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 p-3">
                        <div>
                          <p className="text-sm font-medium">{t('ingest.active')}</p>
                          <p className="text-xs text-muted-foreground">{t('ingest.activeHint')}</p>
                        </div>
                        <Switch
                          checked={formData.isActive}
                          onCheckedChange={(v) => updateField('isActive', v)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ingest-notes">{t('ingest.notes')}</Label>
                        <Textarea
                          id="ingest-notes"
                          value={formData.notes}
                          onChange={(e) => updateField('notes', e.target.value)}
                          rows={4}
                          className={cn('mt-1', FORM_GHOST_TEXTAREA_CLASS)}
                          placeholder={t('ingest.notesPlaceholder')}
                        />
                      </div>
                    </div>
                  </DetailSection>
                </Card>
              ) : null}
            </div>
          </DetailLayout>
        </div>

        <ConfirmDialog
          isOpen={showWarning}
          title={t('dialog.unsavedChanges')}
          message={currentIngest ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
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
