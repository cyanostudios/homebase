import { Info, Smartphone } from 'lucide-react';
import React, { useImperativeHandle, useMemo, useState, useEffect } from 'react';
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

import { usePulses } from '../hooks/usePulses';
import type { PulseCatalogEntry, PulseProviderSettings } from '../types/pulse';

const MASKED = '••••••••';

interface PulseSettingsFormProps {
  currentPulse?: PulseProviderSettings | null;
  onSave?: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel?: () => void;
  onSaveSuccess?: () => void;
}

export const PulseSettingsForm = React.forwardRef<PanelFormHandle, PulseSettingsFormProps>(
  function PulseSettingsForm(
    { currentPulse: currentPulseProp, onSave, onCancel, onSaveSuccess },
    ref,
  ) {
    const { t } = useTranslation();
    const {
      panelMode,
      currentPulse: currentFromContext,
      pendingProviderKey,
      setPendingProviderKey,
      catalog,
      providers,
      saveSettings,
    } = usePulses();

    const currentPulse = currentPulseProp ?? currentFromContext;
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

    const activeProviderKey = pendingProviderKey || currentPulse?.providerKey || '';
    const catalogEntry: PulseCatalogEntry | undefined = catalog.find(
      (entry) => entry.providerKey === activeProviderKey,
    );

    const [enabled, setEnabled] = useState(currentPulse?.enabled ?? true);
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const nextFields: Record<string, string> = {};
      for (const field of catalogEntry?.fields ?? []) {
        if (field.storage === 'secret_primary') {
          nextFields[field.key] = currentPulse?.hasSecretPrimary ? MASKED : '';
        } else if (field.storage === 'secret_secondary') {
          nextFields[field.key] = currentPulse?.hasSecretSecondary ? MASKED : '';
        } else {
          nextFields[field.key] = currentPulse?.options?.[field.key] || '';
        }
      }
      setEnabled(currentPulse?.enabled ?? true);
      setFieldValues(nextFields);
      setError(null);
    }, [activeProviderKey, catalogEntry, currentPulse]);

    const title = activeProviderKey
      ? t(`pulses.providers.${activeProviderKey}.title`, {
          defaultValue: activeProviderKey,
        })
      : t('pulses.chooseProviderPlaceholder', { defaultValue: 'Select a provider…' });
    const settingsDescription = activeProviderKey
      ? t(`pulses.providers.${activeProviderKey}.settingsDescription`, {
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
        setError(t('pulses.chooseProviderError', { defaultValue: 'Choose a provider type' }));
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
            t('pulses.saveError', { defaultValue: 'Failed to save provider' }),
        );
        return false;
      }
    };

    useImperativeHandle(ref, () => ({
      submit: () => handleSave(),
      cancel: () => onCancel?.(),
    }));

    const enabledId = `pulse-${activeProviderKey || 'new'}-enabled`;

    const formSidebar = currentPulse ? (
      <div className="space-y-4">
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('pulses.information', { defaultValue: 'Information' })}
            icon={Info}
            iconPlugin="pulses"
            className="p-4"
            collapsible
          >
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {t('pulses.providerKey', { defaultValue: 'Key' })}
                </span>
                <span className="font-mono font-medium">{currentPulse.providerKey}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('common.created')}</span>
                <span className="font-medium">
                  {currentPulse.createdAt
                    ? new Date(currentPulse.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('common.updated')}</span>
                <span className="font-medium">
                  {currentPulse.updatedAt
                    ? new Date(currentPulse.updatedAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
          </DetailSection>
        </Card>
      </div>
    ) : undefined;

    return (
      <div className="plugin-pulses">
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
                  title={t('pulses.providerType', { defaultValue: 'Provider type' })}
                  icon={Smartphone}
                  iconPlugin="pulses"
                  className="p-6"
                >
                  <div>
                    <Label htmlFor="pulse-provider-type">
                      {t('pulses.providerType', { defaultValue: 'Provider type' })}
                    </Label>
                    <Select
                      value={activeProviderKey || undefined}
                      onValueChange={(value) => setPendingProviderKey(value)}
                    >
                      <SelectTrigger id="pulse-provider-type" className="mt-1">
                        <SelectValue
                          placeholder={t('pulses.chooseProviderPlaceholder', {
                            defaultValue: 'Select a provider…',
                          })}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCatalog.map((entry) => (
                          <SelectItem key={entry.providerKey} value={entry.providerKey}>
                            {t(`pulses.providers.${entry.providerKey}.title`, {
                              defaultValue: entry.providerKey,
                            })}
                            {!entry.smsNotificationCapable
                              ? ` (${t('pulses.verifyOnly', { defaultValue: 'Verify only' })})`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableCatalog.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('pulses.allProvidersConfigured', {
                          defaultValue: 'All catalog providers are already configured.',
                        })}
                      </p>
                    ) : null}
                  </div>
                </DetailSection>
              </Card>
            ) : null}

            {catalogEntry && !catalogEntry.smsNotificationCapable ? (
              <Card className="border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('pulses.notSmsRoutableHint', {
                    defaultValue:
                      'Credentials only — not available for SMS routing in v1 (verify/OTP deferred).',
                  })}
                </p>
              </Card>
            ) : null}

            {activeProviderKey ? (
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection title={title} icon={Smartphone} iconPlugin="pulses" className="p-6">
                  {settingsDescription ? (
                    <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
                  ) : null}

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch id={enabledId} checked={enabled} onCheckedChange={setEnabled} />
                      <Label htmlFor={enabledId}>
                        {t('pulses.enabled', { defaultValue: 'Enabled' })}
                      </Label>
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground">
                      {t('pulses.enabledHint', {
                        defaultValue: 'Disabled providers cannot be selected in routing.',
                      })}
                    </p>

                    {activeProviderKey === 'mock' && (catalogEntry?.fields?.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('pulses.mockDescription')}</p>
                    ) : null}

                    {(catalogEntry?.fields ?? []).map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={`pulse-field-${field.key}`}>
                          {t(field.labelKey, { defaultValue: field.key })}
                        </Label>
                        <Input
                          id={`pulse-field-${field.key}`}
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
                            {t('pulses.secretHint', {
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
