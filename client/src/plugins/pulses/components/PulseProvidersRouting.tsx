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
import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { FORM_COMPACT_SELECT_CLASS, FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { PluginSettingsPageShell } from '@/core/ui/PluginSettingsPageShell';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulsePluginRoutingAssignment, SavePulseRoutingInput } from '../types/pulse';

const GLOBAL_DEFAULT_VALUE = '__global__';

/** Invoice line-item–inspired dense row shell. */
const PLUGIN_ROUTING_ROW_CLASS =
  'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md border border-border/60 px-2.5 py-2';

const PLUGIN_ROUTING_LABEL_CLASS =
  'block text-[10px] font-normal leading-none text-slate-400 dark:text-slate-500';

const PLUGIN_ROUTING_NAME_CLASS = 'truncate text-xs font-semibold text-foreground';

interface PulseProvidersRoutingProps {
  onClose?: () => void;
}

function providerLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  providerKey: string,
) {
  return t(`pulses.providers.${providerKey}.title`, { defaultValue: providerKey });
}

export function PulseProvidersRouting({ onClose }: PulseProvidersRoutingProps = {}) {
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
  } = usePulses();

  const handleClose = onClose ?? closeRoutingView;

  const smsRoutableProviders = useMemo(
    () =>
      providers.filter(
        (provider) => provider.enabled && provider.configured && provider.smsNotificationCapable,
      ),
    [providers],
  );

  const [globalProviderKey, setGlobalProviderKey] = useState('');
  const [initialGlobalProviderKey, setInitialGlobalProviderKey] = useState('');
  const [pluginDrafts, setPluginDrafts] = useState<Record<string, string>>({});
  const [pluginEnabled, setPluginEnabled] = useState<Record<string, boolean>>({});
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
    const nextDrafts: Record<string, string> = {};
    const nextEnabled: Record<string, boolean> = {};
    for (const plugin of routing?.plugins ?? []) {
      nextDrafts[plugin.pluginKey] = plugin.providerKey ?? '';
      nextEnabled[plugin.pluginKey] = Boolean(plugin.enabled);
    }
    setPluginDrafts(nextDrafts);
    setPluginEnabled(nextEnabled);
  }, [routing]);

  const isDirty = globalProviderKey !== initialGlobalProviderKey;

  const handleSaveGlobal = useCallback(async () => {
    if (!globalProviderKey) {
      setError(
        t('pulses.routing.globalProviderRequired', {
          defaultValue: 'Choose a provider for the global default.',
        }),
      );
      return;
    }
    setSavingGlobal(true);
    setError(null);
    try {
      const payload: SavePulseRoutingInput = { providerKey: globalProviderKey };
      await saveGlobalRouting(payload);
      setInitialGlobalProviderKey(globalProviderKey);
    } catch {
      setError(t('pulses.routing.saveError', { defaultValue: 'Failed to save routing settings.' }));
    } finally {
      setSavingGlobal(false);
    }
  }, [globalProviderKey, saveGlobalRouting, t]);

  const handleTogglePluginEnabled = useCallback(
    async (plugin: PulsePluginRoutingAssignment, enabled: boolean) => {
      setPluginEnabled((prev) => ({ ...prev, [plugin.pluginKey]: enabled }));
      setSavingPluginKey(plugin.pluginKey);
      setError(null);
      try {
        await savePluginRouting(plugin.pluginKey, { enabled });
        if (!enabled) {
          setPluginDrafts((prev) => ({ ...prev, [plugin.pluginKey]: '' }));
        }
      } catch {
        setPluginEnabled((prev) => ({ ...prev, [plugin.pluginKey]: plugin.enabled }));
        setError(
          t('pulses.routing.saveError', { defaultValue: 'Failed to save routing settings.' }),
        );
      } finally {
        setSavingPluginKey(null);
      }
    },
    [savePluginRouting, t],
  );

  const handleSavePlugin = useCallback(
    async (plugin: PulsePluginRoutingAssignment) => {
      const providerKey = pluginDrafts[plugin.pluginKey];
      if (!providerKey) {
        setError(
          t('pulses.routing.pluginProviderRequired', {
            defaultValue: 'Choose a provider override or clear the assignment.',
          }),
        );
        return;
      }
      setSavingPluginKey(plugin.pluginKey);
      setError(null);
      try {
        await savePluginRouting(plugin.pluginKey, { providerKey, enabled: true });
        setPluginEnabled((prev) => ({ ...prev, [plugin.pluginKey]: true }));
      } catch {
        setError(
          t('pulses.routing.saveError', { defaultValue: 'Failed to save routing settings.' }),
        );
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
        setError(
          t('pulses.routing.saveError', { defaultValue: 'Failed to save routing settings.' }),
        );
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
      title={t('pulses.routing.title', { defaultValue: 'Pulse – Routing' })}
      subtitle={t('pulses.routing.description', {
        defaultValue:
          'Set a global default SMS provider, then enable Pulse per activated plugin. Only SMS-capable providers appear here.',
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
            title={t('pulses.routing.globalTitle', { defaultValue: 'Global default' })}
            icon={Sparkles}
            iconPlugin="pulses"
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
                {t('pulses.routing.globalHint', {
                  defaultValue:
                    'Used by any plugin with Pulse enabled and no provider override. Only configured and enabled SMS providers are available.',
                })}
              </p>
              <div className="max-w-md">
                <Label htmlFor="pulse-routing-global-provider">
                  {t('pulses.routing.provider', { defaultValue: 'Provider' })}
                </Label>
                <Select value={globalProviderKey || undefined} onValueChange={setGlobalProviderKey}>
                  <SelectTrigger
                    id="pulse-routing-global-provider"
                    className={cn(FORM_INPUT_CLASS, 'mt-1')}
                  >
                    <SelectValue
                      placeholder={t('pulses.chooseProviderPlaceholder', {
                        defaultValue: 'Select a provider…',
                      })}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {smsRoutableProviders.map((provider) => (
                      <SelectItem key={provider.providerKey} value={provider.providerKey}>
                        {providerLabel(t, provider.providerKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {smsRoutableProviders.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('pulses.routing.noSmsProviders', {
                      defaultValue:
                        'Enable Twilio or Mock with credentials — then it appears here.',
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('pulses.routing.pluginsTitle', { defaultValue: 'Per-plugin Pulse SMS' })}
            icon={Route}
            iconPlugin="pulses"
            subtleTitle
            className="p-4 sm:p-6"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              {t('pulses.routing.pluginsHint', {
                defaultValue:
                  'Every activated plugin appears here. Turn on Pulse SMS to allow sending; optionally override the global provider.',
              })}
            </p>
            {pluginRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('pulses.routing.noPlugins', {
                    defaultValue: 'No activated plugins available for Pulse routing.',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pluginRows.map((plugin) => {
                  const draft = pluginDrafts[plugin.pluginKey] ?? '';
                  const enabled = pluginEnabled[plugin.pluginKey] ?? Boolean(plugin.enabled);
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
                      <div className="flex shrink-0 flex-col gap-1">
                        <span className={PLUGIN_ROUTING_LABEL_CLASS}>
                          {t('pulses.routing.pulseEnabled', { defaultValue: 'Pulse' })}
                        </span>
                        <div className="flex h-7 items-center">
                          <Switch
                            checked={enabled}
                            disabled={busy}
                            onCheckedChange={(checked) => {
                              void handleTogglePluginEnabled(plugin, checked);
                            }}
                            aria-label={t('pulses.routing.pulseEnabledAria', {
                              defaultValue: 'Enable Pulse SMS for {{plugin}}',
                              plugin: plugin.label,
                            })}
                          />
                        </div>
                      </div>
                      <div className="min-w-[10rem] flex-1 basis-[10rem]">
                        <Label
                          className={PLUGIN_ROUTING_LABEL_CLASS}
                          htmlFor={`pulse-routing-provider-${plugin.pluginKey}`}
                        >
                          {t('pulses.routing.provider', { defaultValue: 'Provider' })}
                        </Label>
                        <Select
                          value={draft || GLOBAL_DEFAULT_VALUE}
                          disabled={!enabled || busy}
                          onValueChange={(value) => {
                            const providerKey = value === GLOBAL_DEFAULT_VALUE ? '' : value;
                            setPluginDrafts((prev) => ({
                              ...prev,
                              [plugin.pluginKey]: providerKey,
                            }));
                          }}
                        >
                          <SelectTrigger
                            id={`pulse-routing-provider-${plugin.pluginKey}`}
                            className={cn(FORM_COMPACT_SELECT_CLASS, 'mt-1')}
                          >
                            <SelectValue
                              placeholder={t('pulses.routing.useGlobalDefault', {
                                defaultValue: 'Use global default',
                              })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GLOBAL_DEFAULT_VALUE}>
                              {t('pulses.routing.useGlobalDefault', {
                                defaultValue: 'Use global default',
                              })}
                            </SelectItem>
                            {smsRoutableProviders.map((provider) => (
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
                          disabled={!enabled || !hasUnsavedOverride || !draft || busy}
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
                            disabled={!enabled || busy}
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
