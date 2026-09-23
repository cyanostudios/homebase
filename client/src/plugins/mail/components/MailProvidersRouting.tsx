import { Check, Route, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { FORM_COMPACT_SELECT_CLASS, FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';
import type { MailPluginRoutingAssignment, SaveMailRoutingInput } from '../types/mail';

const GLOBAL_DEFAULT_VALUE = '__global__';

/** Invoice line-item–inspired dense row shell. */
const PLUGIN_ROUTING_ROW_CLASS =
  'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md border border-border/60 px-2.5 py-2';

const PLUGIN_ROUTING_LABEL_CLASS =
  'block text-[10px] font-normal leading-none text-slate-400 dark:text-slate-500';

const PLUGIN_ROUTING_NAME_CLASS = 'truncate text-xs font-semibold text-foreground';

interface MailProvidersRoutingProps {
  onClose?: () => void;
}

function providerLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  providerKey: string,
) {
  return t(`mail.providers.${providerKey}.title`, { defaultValue: providerKey });
}

export function MailProvidersRouting({ onClose }: MailProvidersRoutingProps = {}) {
  const { t } = useTranslation();
  const {
    providers,
    routing,
    routingLoading,
    loadProviderSettings,
    loadRouting,
    saveGlobalRouting,
    savePluginRouting,
    deletePluginRouting,
    closeRoutingView,
  } = useMail();

  const handleClose = onClose ?? closeRoutingView;

  const emailRoutableProviders = useMemo(
    () =>
      providers.filter(
        (provider) => provider.enabled && provider.configured && provider.emailCapable,
      ),
    [providers],
  );

  const [globalProviderKey, setGlobalProviderKey] = useState('');
  const [initialGlobalProviderKey, setInitialGlobalProviderKey] = useState('');
  const [pluginDrafts, setPluginDrafts] = useState<Record<string, string>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPluginKey, setSavingPluginKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all([loadProviderSettings(), loadRouting()]).finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadProviderSettings, loadRouting]);

  useEffect(() => {
    const nextProvider = routing?.global?.providerKey ?? '';
    setGlobalProviderKey(nextProvider);
    setInitialGlobalProviderKey(nextProvider);
    const next: Record<string, string> = {};
    for (const plugin of routing?.plugins ?? []) {
      next[plugin.pluginKey] = plugin.providerKey ?? '';
    }
    setPluginDrafts(next);
  }, [routing]);

  const isDirty = globalProviderKey !== initialGlobalProviderKey;

  const handleSaveGlobal = useCallback(async () => {
    if (!globalProviderKey) {
      setError(
        t('mail.routing.globalProviderRequired', {
          defaultValue: 'Choose a provider for the global default.',
        }),
      );
      return;
    }
    setSavingGlobal(true);
    setError(null);
    try {
      const payload: SaveMailRoutingInput = { providerKey: globalProviderKey };
      await saveGlobalRouting(payload);
      setInitialGlobalProviderKey(globalProviderKey);
    } catch {
      setError(t('mail.routing.saveError', { defaultValue: 'Failed to save routing settings.' }));
    } finally {
      setSavingGlobal(false);
    }
  }, [globalProviderKey, saveGlobalRouting, t]);

  const handleSavePlugin = useCallback(
    async (plugin: MailPluginRoutingAssignment) => {
      const providerKey = pluginDrafts[plugin.pluginKey];
      if (!providerKey) {
        setError(
          t('mail.routing.pluginProviderRequired', {
            defaultValue: 'Choose a provider override or clear the assignment.',
          }),
        );
        return;
      }
      setSavingPluginKey(plugin.pluginKey);
      setError(null);
      try {
        await savePluginRouting(plugin.pluginKey, { providerKey });
      } catch {
        setError(t('mail.routing.saveError', { defaultValue: 'Failed to save routing settings.' }));
      } finally {
        setSavingPluginKey(null);
      }
    },
    [pluginDrafts, savePluginRouting, t],
  );

  const handleClearPlugin = useCallback(
    async (pluginKey: string) => {
      setSavingPluginKey(pluginKey);
      setError(null);
      try {
        await deletePluginRouting(pluginKey);
        setPluginDrafts((prev) => ({ ...prev, [pluginKey]: '' }));
      } catch {
        setError(t('mail.routing.saveError', { defaultValue: 'Failed to save routing settings.' }));
      } finally {
        setSavingPluginKey(null);
      }
    },
    [deletePluginRouting, t],
  );

  if (isLoading || (routingLoading && !routing)) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('common.loading', { defaultValue: 'Loading…' })}
      </div>
    );
  }

  const pluginRows = routing?.plugins ?? [];

  return (
    <PluginSettingsPageShell
      title={t('mail.routing.title', { defaultValue: 'Mail – Routing' })}
      subtitle={t('mail.routing.description', {
        defaultValue:
          'Set a global default email provider and optional per-plugin overrides. Only email-capable providers appear here.',
      })}
      categories={[]}
      onClose={handleClose}
      onSave={isDirty ? () => void handleSaveGlobal() : undefined}
      isSaving={savingGlobal}
      wrapContentInCard={false}
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('mail.routing.globalTitle', { defaultValue: 'Global default' })}
            icon={Sparkles}
            iconPlugin="mail"
            subtleTitle
            className="p-4 sm:p-6"
            action={
              isDirty ? (
                <RoundIconLabelButton
                  type="button"
                  icon={Check}
                  label={
                    savingGlobal
                      ? t('common.saving', { defaultValue: 'Saving…' })
                      : t('common.save', { defaultValue: 'Save' })
                  }
                  variant="success"
                  size="xs"
                  alwaysExpanded
                  disabled={savingGlobal || !globalProviderKey}
                  onClick={() => void handleSaveGlobal()}
                />
              ) : null
            }
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('mail.routing.globalHint', {
                  defaultValue:
                    'Used by any plugin without its own override. Only configured and enabled email providers are available.',
                })}
              </p>
              <div className="max-w-md">
                <Label htmlFor="mail-routing-global-provider">
                  {t('mail.routing.provider', { defaultValue: 'Provider' })}
                </Label>
                <Select value={globalProviderKey || undefined} onValueChange={setGlobalProviderKey}>
                  <SelectTrigger
                    id="mail-routing-global-provider"
                    className={cn(FORM_INPUT_CLASS, 'mt-1')}
                  >
                    <SelectValue
                      placeholder={t('mail.chooseProviderPlaceholder', {
                        defaultValue: 'Select a provider…',
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {emailRoutableProviders.map((provider) => (
                      <SelectItem key={provider.providerKey} value={provider.providerKey}>
                        {providerLabel(t, provider.providerKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {emailRoutableProviders.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('mail.routing.noEmailProviders', {
                      defaultValue:
                        'Enable SMTP or Resend with credentials — then it appears here.',
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('mail.routing.pluginsTitle', { defaultValue: 'Per-plugin overrides' })}
            icon={Route}
            iconPlugin="mail"
            subtleTitle
            className="p-4 sm:p-6"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              {t('mail.routing.pluginsHint', {
                defaultValue:
                  'Optional. When set, a plugin uses its assigned provider instead of the global default.',
              })}
            </p>
            {pluginRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('mail.routing.noPlugins', {
                    defaultValue: 'No activated plugins available for Mail routing.',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pluginRows.map((plugin) => {
                  const draft = pluginDrafts[plugin.pluginKey] ?? '';
                  const busy = savingPluginKey === plugin.pluginKey;
                  const savedProvider = plugin.providerKey ?? '';
                  const hasUnsavedOverride = draft !== savedProvider;
                  return (
                    <div key={plugin.pluginKey} className={PLUGIN_ROUTING_ROW_CLASS}>
                      <div className="min-w-[7rem] flex-1 basis-[7rem]">
                        <span className={PLUGIN_ROUTING_NAME_CLASS} title={plugin.label}>
                          {plugin.label}
                        </span>
                      </div>
                      <div className="min-w-[10rem] flex-1 basis-[10rem]">
                        <Label
                          className={PLUGIN_ROUTING_LABEL_CLASS}
                          htmlFor={`mail-routing-provider-${plugin.pluginKey}`}
                        >
                          {t('mail.routing.provider', { defaultValue: 'Provider' })}
                        </Label>
                        <Select
                          value={draft || GLOBAL_DEFAULT_VALUE}
                          disabled={busy}
                          onValueChange={(value) => {
                            const providerKey = value === GLOBAL_DEFAULT_VALUE ? '' : value;
                            setPluginDrafts((prev) => ({
                              ...prev,
                              [plugin.pluginKey]: providerKey,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id={`mail-routing-provider-${plugin.pluginKey}`}
                            className={cn(FORM_COMPACT_SELECT_CLASS, 'mt-1')}
                          >
                            <SelectValue
                              placeholder={t('mail.routing.inheritGlobal', {
                                defaultValue: 'Inherit global',
                              })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GLOBAL_DEFAULT_VALUE}>
                              {t('mail.routing.inheritGlobal', {
                                defaultValue: 'Inherit global',
                              })}
                            </SelectItem>
                            {emailRoutableProviders.map((provider) => (
                              <SelectItem key={provider.providerKey} value={provider.providerKey}>
                                {providerLabel(t, provider.providerKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 self-end">
                        <RoundIconLabelButton
                          type="button"
                          icon={Check}
                          label={
                            busy
                              ? t('common.saving', { defaultValue: 'Saving…' })
                              : t('common.save', { defaultValue: 'Save' })
                          }
                          variant="success"
                          size="xs"
                          alwaysExpanded
                          disabled={!hasUnsavedOverride || !draft || busy}
                          onClick={() => void handleSavePlugin(plugin)}
                        />
                        {plugin.providerKey ? (
                          <RoundIconLabelButton
                            type="button"
                            icon={X}
                            label={t('common.clear', { defaultValue: 'Clear' })}
                            variant="secondary"
                            size="xs"
                            alwaysExpanded
                            disabled={busy}
                            onClick={() => void handleClearPlugin(plugin.pluginKey)}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailSection>
        </Card>
      </div>
    </PluginSettingsPageShell>
  );
}
