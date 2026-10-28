/**
 * Create/edit form — see docs/ai/design/SITE_AUDITS_UX.md "Create / edit form"
 * and docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md §3.
 */
import { Globe } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_INPUT_CLASS,
  FORM_INPUT_ERROR_CLASS,
} from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/lib/utils';

import { useSiteAudits } from '../hooks/useSiteAudits';
import type { SiteAudit, SiteAuditPayload } from '../types/site-audits';

interface SiteAuditFormProps {
  currentItem?: SiteAudit | null;
  currentSiteAudit?: SiteAudit | null;
  onSave: (data: SiteAuditPayload) => Promise<boolean> | boolean;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Single-column stack in list mail-layout aside. */
  stacked?: boolean;
  /** Close/Update rendered beside the form — view-chrome parity. */
  headerTrailing?: React.ReactNode;
}

export const SiteAuditForm = React.forwardRef<PanelFormHandle, SiteAuditFormProps>(
  function SiteAuditForm(
    {
      currentItem,
      currentSiteAudit,
      onSave,
      onCancel,
      isSubmitting: externalIsSubmitting = false,
      stacked: _stacked = false,
      headerTrailing,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const current = currentSiteAudit ?? currentItem ?? null;
    const { validationErrors, clearValidationErrors, isSaving } = useSiteAudits();
    const { showWarning, markDirty, markClean, attemptAction, confirmDiscard, cancelDiscard } =
      useUnsavedChanges();
    const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
      useGlobalNavigationGuard();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<SiteAuditPayload>({
      name: '',
      url: '',
      competitorUrl: '',
    });

    const isCurrentlySubmitting = externalIsSubmitting || isSaving || isSubmitting;

    useEffect(() => {
      const formKey = `site-audit-form-${current?.id || 'new'}`;
      // Aligned mail-layout forms confirm leave while open (not only when dirty) — see
      // docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md §5.3.
      registerUnsavedChangesChecker(formKey, () => true);
      return () => unregisterUnsavedChangesChecker(formKey);
    }, [current, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

    const resetForm = useCallback(() => {
      setFormData({ name: '', url: '', competitorUrl: '' });
      markClean();
    }, [markClean]);

    useEffect(() => {
      if (current) {
        setFormData({
          name: current.name || '',
          url: current.url || '',
          competitorUrl: current.competitorUrl || '',
        });
        markClean();
      } else {
        resetForm();
      }
    }, [current, markClean, resetForm]);

    const handleSubmit = useCallback(async () => {
      if (isCurrentlySubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const ok = await onSave(formData);
        if (ok) {
          markClean();
          if (!current) {
            resetForm();
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    }, [formData, onSave, markClean, current, resetForm, isCurrentlySubmitting]);

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
      if (!current) {
        resetForm();
        setTimeout(() => confirmDiscard(), 0);
      } else {
        confirmDiscard();
        onCancel();
      }
    };

    const getFieldError = (field: string) => validationErrors.find((err) => err.field === field);
    const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

    const updateField = (field: keyof SiteAuditPayload, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      markDirty();
      clearValidationErrors();
    };

    return (
      <>
        <div className="plugin-site-audits">
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

              <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex flex-col')}>
                <div className="px-4 py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex shrink-0" aria-hidden>
                      <SectionCategoryIcon
                        icon={Globe}
                        className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="site-audit-name" className="sr-only">
                        {t('siteAudits.name')}
                      </Label>
                      <Input
                        id="site-audit-name"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder={t('siteAudits.namePlaceholder')}
                        aria-label={t('siteAudits.name')}
                        className={cn(
                          FORM_GHOST_INPUT_CLASS,
                          PLUGIN_PAGE_TITLE_CLASS,
                          'min-w-0 tracking-[0.003em]',
                          getFieldError('name') && FORM_INPUT_ERROR_CLASS,
                        )}
                      />
                      {getFieldError('name') ? (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('name')?.message}
                        </p>
                      ) : null}
                    </div>
                    {headerTrailing ? (
                      <div className="flex shrink-0 items-center gap-1">{headerTrailing}</div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={t('siteAudits.sectionDetails')} icon={Globe} className="p-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="site-audit-url">{t('siteAudits.url')}</Label>
                      <Input
                        id="site-audit-url"
                        value={formData.url}
                        onChange={(e) => updateField('url', e.target.value)}
                        placeholder="https://example.com"
                        className={cn(
                          'font-mono',
                          FORM_INPUT_CLASS,
                          getFieldError('url') && FORM_INPUT_ERROR_CLASS,
                        )}
                      />
                      {getFieldError('url') ? (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('url')?.message}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('siteAudits.urlHint')}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="site-audit-competitor-url">
                        {t('siteAudits.competitorUrl')}
                      </Label>
                      <Input
                        id="site-audit-competitor-url"
                        value={formData.competitorUrl ?? ''}
                        onChange={(e) => updateField('competitorUrl', e.target.value)}
                        placeholder="https://competitor.com"
                        className={cn(
                          'font-mono',
                          FORM_INPUT_CLASS,
                          getFieldError('competitorUrl') && FORM_INPUT_ERROR_CLASS,
                        )}
                      />
                      {getFieldError('competitorUrl') ? (
                        <p className="mt-1 text-sm text-destructive">
                          {getFieldError('competitorUrl')?.message}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('siteAudits.competitorUrlHint')}
                        </p>
                      )}
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
          message={current ? t('dialog.discardAndReturn') : t('dialog.discardAndClose')}
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
