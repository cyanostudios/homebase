// Default texts settings: shared tenant mail body defaults for invoice/estimate send dialogs.

import { FileText, ScrollText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import {
  cloneDefaultTexts,
  defaultTextsApi,
  EMPTY_DEFAULT_TEXTS,
  type DefaultTexts,
} from '@/core/api/defaultTextsApi';
import { DETAIL_FIELD_LABEL_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { DetailSection } from '@/core/ui/DetailSection';
import { FORM_TEXTAREA_CLASS } from '@/core/ui/formFieldStyles';
import { cn } from '@/lib/utils';
import { useSettingsContext } from '@/plugins/settings/context/SettingsContext';

interface DefaultTextsSettingsFormProps {
  onCancel: () => void;
}

function defaultTextsEqual(a: DefaultTexts, b: DefaultTexts): boolean {
  return a.invoiceMail === b.invoiceMail && a.estimateMail === b.estimateMail;
}

export function DefaultTextsSettingsForm({ onCancel }: DefaultTextsSettingsFormProps) {
  const { t } = useTranslation();
  const { refreshDefaultTexts } = useApp();
  const { registerSaveHandler, setIsSaving, setHasChanges } = useSettingsContext();
  const [isLoading, setIsLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [formData, setFormData] = useState<DefaultTexts>(() =>
    cloneDefaultTexts(EMPTY_DEFAULT_TEXTS),
  );
  const [initialFormData, setInitialFormData] = useState<DefaultTexts>(() =>
    cloneDefaultTexts(EMPTY_DEFAULT_TEXTS),
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (canEdit) {
        const saved = await defaultTextsApi.updateDefaultTexts(formData);
        const next = cloneDefaultTexts(saved);
        setFormData(next);
        setInitialFormData(cloneDefaultTexts(next));
        await refreshDefaultTexts();
      }
      setHasChanges(false);
      onCancel();
    } catch (error) {
      console.error('Failed to save default texts settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, formData, onCancel, refreshDefaultTexts, setIsSaving, setHasChanges]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const [texts, meRes] = await Promise.all([
          defaultTextsApi.getDefaultTexts().catch(() => cloneDefaultTexts(EMPTY_DEFAULT_TEXTS)),
          fetch('/api/auth/me', { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const next = cloneDefaultTexts(texts);
        setFormData(next);
        setInitialFormData(cloneDefaultTexts(next));

        const role = typeof meRes?.tenantRole === 'string' ? meRes.tenantRole : 'user';
        setCanEdit(role === 'admin' || role === 'editor');
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load default texts settings:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [setHasChanges]);

  const isDirty = useMemo(() => {
    return canEdit && !defaultTextsEqual(formData, initialFormData);
  }, [formData, initialFormData, canEdit]);

  useEffect(() => {
    setHasChanges(isDirty);
    return () => setHasChanges(false);
  }, [isDirty, setHasChanges]);

  useEffect(() => {
    registerSaveHandler(handleSave);
    return () => registerSaveHandler(null);
  }, [registerSaveHandler, handleSave]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const readOnly = !canEdit;

  return (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('defaultTexts.invoiceMail', { defaultValue: 'Default text for invoice mail' })}
          icon={FileText}
          subtleTitle
          className="p-4 sm:p-6"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            {t('defaultTexts.invoiceMailHint', {
              defaultValue:
                'Shown in the message field when emailing an invoice. You can edit or clear it before sending.',
            })}
          </p>
          <Label htmlFor="default-texts-invoice-mail" className={DETAIL_FIELD_LABEL_CLASS}>
            {t('defaultTexts.invoiceMailBody', { defaultValue: 'Message' })}
          </Label>
          <textarea
            id="default-texts-invoice-mail"
            className={cn(FORM_TEXTAREA_CLASS, 'mt-1 min-h-[120px] w-full')}
            value={formData.invoiceMail}
            disabled={readOnly}
            onChange={(e) => setFormData({ ...formData, invoiceMail: e.target.value })}
            placeholder={t('defaultTexts.invoiceMailPlaceholder', {
              defaultValue: 'Enter default message for invoice emails…',
            })}
          />
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('defaultTexts.estimateMail', { defaultValue: 'Default text for estimate mail' })}
          icon={ScrollText}
          subtleTitle
          className="p-4 sm:p-6"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            {t('defaultTexts.estimateMailHint', {
              defaultValue:
                'Shown in the message field when emailing an estimate. You can edit or clear it before sending.',
            })}
          </p>
          <Label htmlFor="default-texts-estimate-mail" className={DETAIL_FIELD_LABEL_CLASS}>
            {t('defaultTexts.estimateMailBody', { defaultValue: 'Message' })}
          </Label>
          <textarea
            id="default-texts-estimate-mail"
            className={cn(FORM_TEXTAREA_CLASS, 'mt-1 min-h-[120px] w-full')}
            value={formData.estimateMail}
            disabled={readOnly}
            onChange={(e) => setFormData({ ...formData, estimateMail: e.target.value })}
            placeholder={t('defaultTexts.estimateMailPlaceholder', {
              defaultValue: 'Enter default message for estimate emails…',
            })}
          />
        </DetailSection>
      </Card>
    </div>
  );
}
