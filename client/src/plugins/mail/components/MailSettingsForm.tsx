import { Info, Mail } from 'lucide-react';
import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
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
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';

import { useMail } from '../hooks/useMail';
import type { MailCatalogEntry, MailProviderSettings } from '../types/mail';

const MASKED = '••••••••';

interface MailSettingsFormProps {
  currentMail?: MailProviderSettings | null;
  onSave?: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel?: () => void;
  onSaveSuccess?: () => void;
}

export const MailSettingsForm = React.forwardRef<PanelFormHandle, MailSettingsFormProps>(
  function MailSettingsForm(
    { currentMail: currentMailProp, onSave, onCancel, onSaveSuccess },
    ref,
  ) {
    const { t } = useTranslation();
    const {
      panelMode,
      currentMail: currentFromContext,
      pendingProviderKey,
      setPendingProviderKey,
      catalog,
      providers,
      saveSettings,
    } = useMail();

    const currentMail = currentMailProp ?? currentFromContext;
    const configuredKeys = useMemo(
      () => new Set(providers.map((provider) => provider.providerKey)),
      [providers],
    );

    const availableCatalog = useMemo(
      () =>
        panelMode === 'create'
          ? catalog.filter((entry) => !configuredKeys.has(entry.providerKey))
          : catalog,
      [catalog, configuredKeys, panelMode],
    );

    const activeProviderKey = pendingProviderKey || currentMail?.providerKey || '';
    const catalogEntry: MailCatalogEntry | undefined = catalog.find(
      (entry) => entry.providerKey === activeProviderKey,
    );

    const [enabled, setEnabled] = useState(currentMail?.enabled ?? true);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const nextFields: Record<string, string> = {};
      for (const field of catalogEntry?.fields ?? []) {
        if (field.storage === 'secret_primary') {
          nextFields[field.key] = currentMail?.hasSecretPrimary ? MASKED : '';
        } else if (field.storage === 'secret_secondary') {
          nextFields[field.key] = currentMail?.hasSecretSecondary ? MASKED : '';
        } else {
          nextFields[field.key] = currentMail?.options?.[field.key] || '';
        }
      }
      setEnabled(currentMail?.enabled ?? true);
      setFieldValues(nextFields);
      setError(null);
    }, [activeProviderKey, catalogEntry, currentMail]);

    const title = activeProviderKey
      ? t(`mail.providers.${activeProviderKey}.title`, {
          defaultValue: activeProviderKey,
        })
      : t('mail.chooseProviderPlaceholder', { defaultValue: 'Select a provider…' });
    const settingsDescription = activeProviderKey
      ? t(`mail.providers.${activeProviderKey}.settingsDescription`, {
          defaultValue: '',
        })
      : '';

    const buildPayload = () => {
      const fields: Record<string, string | null> = {};
      const options: Record<string, string | null> = {};
      let secretPrimary: string | null | undefined;
      let secretSecondary: string | null | undefined;

      for (const field of catalogEntry?.fields ?? []) {
        const raw = fieldValues[field.key] ?? '';
        if (field.storage === 'secret_primary') {
          if (!raw || raw.startsWith(MASKED)) {
            // keep saved
          } else {
            secretPrimary = raw.trim();
            fields[field.key] = raw.trim();
          }
        } else if (field.storage === 'secret_secondary') {
          if (!raw || raw.startsWith(MASKED)) {
            // keep saved
          } else {
            secretSecondary = raw.trim();
            fields[field.key] = raw.trim();
          }
        } else {
          options[field.key] = raw.trim() || null;
          fields[field.key] = raw.trim() || null;
        }
      }

      return {
        providerKey: activeProviderKey,
        enabled,
        secretPrimary,
        secretSecondary,
        options,
        fields,
      };
    };

    const handleSave = async () => {
      if (!activeProviderKey) {
        setError(t('mail.chooseProviderError', { defaultValue: 'Choose a provider type' }));
        return false;
      }
      setError(null);
      try {
        const payload = buildPayload();
        if (onSave) {
          const ok = await onSave(payload);
          if (ok) onSaveSuccess?.();
          return ok;
        }
        await saveSettings(activeProviderKey, payload);
        onSaveSuccess?.();
        return true;
      } catch (err: unknown) {
        setError(
          (err as Error)?.message ||
            t('mail.saveError', { defaultValue: 'Failed to save provider' }),
        );
        return false;
      }
    };

    useImperativeHandle(ref, () => ({
      submit: () => handleSave(),
      cancel: () => onCancel?.(),
    }));

    const enabledId = `mail-${activeProviderKey || 'new'}-enabled`;

    const formSidebar = currentMail ? (
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('mail.information', { defaultValue: 'Information' })}
            icon={Info}
            iconPlugin="mail"
            className="p-4"
            collapsible
          >
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('mail.providerKey', { defaultValue: 'Key' })}
                </span>
                <span className="font-mono font-medium">{currentMail.providerKey}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('common.created')}</span>
                <span className="font-medium">
                  {currentMail.createdAt
                    ? new Date(currentMail.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('common.updated')}</span>
                <span className="font-medium">
                  {currentMail.updatedAt
                    ? new Date(currentMail.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          </DetailSection>
        </Card>
      </div>
    ) : undefined;

    return (
      <div className="plugin-mail">
        <DetailLayout sidebar={formSidebar}>
          <div className="space-y-6">
            {error ? (
              <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
                <p className="text-sm text-destructive">{error}</p>
              </Card>
            ) : null}

            {panelMode === 'create' ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('mail.providerType', { defaultValue: 'Provider type' })}
                  icon={Mail}
                  iconPlugin="mail"
                  className="p-6"
                >
                  <div>
                    <Label htmlFor="mail-provider-type">
                      {t('mail.providerType', { defaultValue: 'Provider type' })}
                    </Label>
                    <Select
                      value={activeProviderKey || undefined}
                      onValueChange={(value) => setPendingProviderKey(value)}
                    >
                      <SelectTrigger id="mail-provider-type" className="mt-1">
                        <SelectValue
                          placeholder={t('mail.chooseProviderPlaceholder', {
                            defaultValue: 'Select a provider…',
                          })}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCatalog.map((entry) => (
                          <SelectItem key={entry.providerKey} value={entry.providerKey}>
                            {t(`mail.providers.${entry.providerKey}.title`, {
                              defaultValue: entry.providerKey,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableCatalog.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('mail.allProvidersConfigured', {
                          defaultValue: 'All catalog providers are already configured.',
                        })}
                      </p>
                    ) : null}
                  </div>
                </DetailSection>
              </Card>
            ) : null}

            {activeProviderKey ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={title} icon={Mail} iconPlugin="mail" className="p-6">
                  {settingsDescription ? (
                    <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
                  ) : null}

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch id={enabledId} checked={enabled} onCheckedChange={setEnabled} />
                      <Label htmlFor={enabledId}>
                        {t('mail.enabled', { defaultValue: 'Enabled' })}
                      </Label>
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground">
                      {t('mail.enabledHint', {
                        defaultValue: 'Disabled providers cannot be selected in routing.',
                      })}
                    </p>

                    {(catalogEntry?.fields ?? []).map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={`mail-field-${field.key}`}>
                          {t(field.labelKey, { defaultValue: field.key })}
                        </Label>
                        <Input
                          id={`mail-field-${field.key}`}
                          className="mt-1"
                          type={field.secret ? 'password' : 'text'}
                          autoComplete={field.secret ? 'new-password' : 'off'}
                          value={fieldValues[field.key] || ''}
                          onChange={(e) =>
                            setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          }
                          placeholder={field.secret ? MASKED : undefined}
                        />
                        {field.secret ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('mail.secretHint', {
                              defaultValue:
                                'Leave unchanged to keep the stored value. Clear and save to remove it.',
                            })}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </DetailSection>
              </Card>
            ) : null}
          </div>
        </DetailLayout>
      </div>
    );
  },
);
