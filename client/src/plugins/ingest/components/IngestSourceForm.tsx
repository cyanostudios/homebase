import { Info } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useIngest } from '../hooks/useIngest';
import type { IngestFetchMethod, IngestSource, IngestSourceType } from '../types/ingest';

const CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm rounded-lg';
const PANEL_MAX_WIDTH = 'max-w-[720px]';

const ALLOWED_SOURCE_TYPES: IngestSourceType[] = ['html', 'pdf', 'json', 'xml', 'other'];
function normalizeSourceType(t: string | undefined): IngestSourceType {
  if (t && ALLOWED_SOURCE_TYPES.includes(t as IngestSourceType)) {
    return t as IngestSourceType;
  }
  return 'other';
}

function normalizeFetchMethod(m: string | undefined): IngestFetchMethod {
  return m === 'browser_fetch' ? 'browser_fetch' : 'generic_http';
}

interface IngestSourceFormProps {
  currentIngest?: IngestSource | null;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const IngestSourceForm = React.forwardRef<PanelFormHandle, IngestSourceFormProps>(
  function IngestSourceForm(
    { currentIngest, onSave, onCancel, isSubmitting: externalIsSubmitting = false },
    ref,
  ) {
    const { t } = useTranslation();
    const { validationErrors, clearValidationErrors, panelMode } = useIngest();
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
      registerUnsavedChangesChecker(key, () => isDirty);
      return () => unregisterUnsavedChangesChecker(key);
    }, [isDirty, currentIngest, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

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
      attemptAction(() => {
        onCancel();
      });
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

    const title = panelMode === 'create' ? t('ingest.newSource') : t('ingest.editSource');
    const subtitle = currentIngest?.id
      ? formatDisplayNumber('ingest', currentIngest.id)
      : t('ingest.subtitleNew');

    return (
      <>
        <DetailLayout title={title} subtitle={subtitle} maxWidthClass={PANEL_MAX_WIDTH}>
          <div className="space-y-4">
            {validationErrors
              .filter((e) => e.field === 'general')
              .map((e) => (
                <p key={e.message} className="text-sm text-destructive">
                  {e.message}
                </p>
              ))}
            <Card padding="none" className={CARD_CLASS}>
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
                      className="mt-1"
                    />
                    {getFieldError('name') && (
                      <p className="text-xs text-destructive mt-1">
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
                      className="mt-1 font-mono text-sm"
                    />
                    {getFieldError('sourceUrl') && (
                      <p className="text-xs text-destructive mt-1">
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
                      <SelectTrigger className="mt-1">
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
                      <SelectTrigger id="ingest-fetch-method" className="mt-1">
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
                      <p className="text-xs text-destructive mt-1">
                        {getFieldError('fetchMethod')?.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
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
                      className="mt-1"
                      placeholder={t('ingest.notesPlaceholder')}
                    />
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        </DetailLayout>

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
