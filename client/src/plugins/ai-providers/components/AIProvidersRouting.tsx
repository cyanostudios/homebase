import { Check, Route, Sparkles } from 'lucide-react';
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

import { useAIProviders } from '../hooks/useAIProviders';
import type {
  PluginRoutingAssignment,
  ProviderCatalogEntry,
  SaveProviderRoutingInput,
} from '../types/aiProviders';

const NONE_VALUE = '__none__';
const GLOBAL_DEFAULT_VALUE = '__global__';

/** Invoice line-item–inspired dense row shell. */
const PLUGIN_ROUTING_ROW_CLASS =
  'flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md border border-border/60 px-2.5 py-2';

const PLUGIN_ROUTING_LABEL_CLASS =
  'block text-[10px] font-normal leading-none text-slate-400 dark:text-slate-500';

const PLUGIN_ROUTING_NAME_CLASS = 'truncate text-xs font-semibold text-foreground';

interface AIProvidersRoutingProps {
  onClose?: () => void;
}

function providerLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  providerKey: string,
) {
  return t(`aiProviders.providers.${providerKey}.title`, {
    defaultValue: providerKey,
  });
}

function modelOptionsForProvider(
  catalog: ProviderCatalogEntry[],
  providerKey: string,
  currentModel?: string | null,
) {
  const entry = catalog.find((item) => item.providerKey === providerKey);
  const options = (entry?.models ?? []).map((model) => ({
    id: model.id,
    label: model.label || model.id,
  }));
  const current = String(currentModel ?? '').trim();
  if (current && !options.some((option) => option.id === current)) {
    options.unshift({ id: current, label: current });
  }
  return options;
}

export function AIProvidersRouting({ onClose }: AIProvidersRoutingProps = {}) {
  const { t } = useTranslation();
  const {
    catalog,
    providers,
    routing,
    routingLoading,
    loadSettings,
    loadRouting,
    saveGlobalRouting,
    savePluginRouting,
    closeRoutingView,
  } = useAIProviders();

  const handleClose = onClose ?? closeRoutingView;

  /** Providers that can be assigned in routing (enabled + stored API key). */
  const routableProviders = useMemo(
    () => providers.filter((provider) => provider.enabled && provider.hasApiKey),
    [providers],
  );

  /** Global + Guides may only route to providers with a real text-generation adapter. */
  const textGeneratableRoutableProviders = useMemo(
    () =>
      routableProviders.filter((provider) => {
        const entry = catalog.find((item) => item.providerKey === provider.providerKey);
        return entry?.textGenerationCapable === true;
      }),
    [routableProviders, catalog],
  );

  /** Guides (audio) may only route to providers with a real audio-generation adapter. */
  const audioGeneratableRoutableProviders = useMemo(
    () =>
      routableProviders.filter((provider) => {
        const entry = catalog.find((item) => item.providerKey === provider.providerKey);
        return entry?.audioGenerationCapable === true;
      }),
    [routableProviders, catalog],
  );

  const providersForPluginScope = useCallback(
    (pluginKey: string) => {
      if (pluginKey === 'guides') return textGeneratableRoutableProviders;
      if (pluginKey === 'guides-audio') return audioGeneratableRoutableProviders;
      return routableProviders;
    },
    [textGeneratableRoutableProviders, audioGeneratableRoutableProviders, routableProviders],
  );

  const [globalProviderKey, setGlobalProviderKey] = useState('');
  const [globalModel, setGlobalModel] = useState('');
  const [initialGlobalProviderKey, setInitialGlobalProviderKey] = useState('');
  const [initialGlobalModel, setInitialGlobalModel] = useState('');
  const [pluginDrafts, setPluginDrafts] = useState<
    Record<string, { providerKey: string; model: string }>
  >({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPluginKey, setSavingPluginKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void Promise.all([loadSettings(), loadRouting()]).finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadSettings, loadRouting]);

  useEffect(() => {
    const nextProvider = routing?.global?.providerKey ?? '';
    const nextModel = routing?.global?.model ?? '';
    setGlobalProviderKey(nextProvider);
    setGlobalModel(nextModel);
    setInitialGlobalProviderKey(nextProvider);
    setInitialGlobalModel(nextModel);
    const nextDrafts: Record<string, { providerKey: string; model: string }> = {};
    for (const plugin of routing?.plugins ?? []) {
      nextDrafts[plugin.pluginKey] = {
        providerKey: plugin.providerKey ?? '',
        model: plugin.model ?? '',
      };
    }
    setPluginDrafts(nextDrafts);
  }, [routing]);

  const globalModelOptions = useMemo(
    () => modelOptionsForProvider(catalog, globalProviderKey, globalModel),
    [catalog, globalModel, globalProviderKey],
  );

  const isDirty =
    globalProviderKey !== initialGlobalProviderKey || globalModel !== initialGlobalModel;

  const handleSaveGlobal = useCallback(async () => {
    if (!globalProviderKey) {
      setError(
        t('aiProviders.routing.globalProviderRequired', {
          defaultValue: 'Choose a provider for the global default.',
        }),
      );
      return;
    }
    setSavingGlobal(true);
    setError(null);
    try {
      const payload: SaveProviderRoutingInput = {
        providerKey: globalProviderKey,
        model: globalModel.trim() || null,
      };
      await saveGlobalRouting(payload);
      setInitialGlobalProviderKey(globalProviderKey);
      setInitialGlobalModel(globalModel);
    } catch {
      setError(
        t('aiProviders.routing.saveError', {
          defaultValue: 'Failed to save routing settings.',
        }),
      );
    } finally {
      setSavingGlobal(false);
    }
  }, [globalModel, globalProviderKey, saveGlobalRouting, t]);

  const handleSavePlugin = useCallback(
    async (plugin: PluginRoutingAssignment) => {
      const draft = pluginDrafts[plugin.pluginKey];
      if (!draft?.providerKey) {
        setError(
          t('aiProviders.routing.pluginProviderRequired', {
            defaultValue: 'Choose a provider override or clear the assignment.',
          }),
        );
        return;
      }
      setSavingPluginKey(plugin.pluginKey);
      setError(null);
      try {
        await savePluginRouting(plugin.pluginKey, {
          providerKey: draft.providerKey,
          model: draft.model.trim() || null,
        });
      } catch {
        setError(
          t('aiProviders.routing.saveError', {
            defaultValue: 'Failed to save routing settings.',
          }),
        );
      } finally {
        setSavingPluginKey(null);
      }
    },
    [pluginDrafts, savePluginRouting, t],
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
      title={t('aiProviders.routing.title', { defaultValue: 'AI Providers – Routing' })}
      subtitle={t('aiProviders.routing.description', {
        defaultValue:
          'Set a global default provider and optional per-plugin overrides. Plugins request AI through routing — never a specific vendor directly.',
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
            title={t('aiProviders.routing.globalTitle', { defaultValue: 'Global default' })}
            icon={Sparkles}
            iconPlugin="ai-providers"
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
                {t('aiProviders.routing.globalHint', {
                  defaultValue:
                    'Used by any plugin without its own override. Only configured and enabled providers are available.',
                })}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="ai-routing-global-provider">
                    {t('aiProviders.routing.provider', { defaultValue: 'Provider' })}
                  </Label>
                  <Select
                    value={globalProviderKey || undefined}
                    onValueChange={(value) => {
                      setGlobalProviderKey(value);
                      const entry = catalog.find((item) => item.providerKey === value);
                      setGlobalModel(entry?.defaultModel ?? '');
                    }}
                  >
                    <SelectTrigger
                      id="ai-routing-global-provider"
                      className={cn(FORM_INPUT_CLASS, 'mt-1')}
                    >
                      <SelectValue
                        placeholder={t('aiProviders.chooseProviderPlaceholder', {
                          defaultValue: 'Select a provider…',
                        })}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {textGeneratableRoutableProviders.map((provider) => (
                        <SelectItem key={provider.providerKey} value={provider.providerKey}>
                          {providerLabel(t, provider.providerKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {textGeneratableRoutableProviders.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('aiProviders.routing.noGeneratableProviders', {
                        defaultValue:
                          'Enable OpenAI (or another text-capable provider) with an API key — then it appears here.',
                      })}
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="ai-routing-global-model">
                    {t('aiProviders.defaultModel', { defaultValue: 'Default model' })}
                  </Label>
                  {globalModelOptions.length > 0 ? (
                    <Select value={globalModel || undefined} onValueChange={setGlobalModel}>
                      <SelectTrigger
                        id="ai-routing-global-model"
                        className={cn(FORM_INPUT_CLASS, 'mt-1')}
                      >
                        <SelectValue
                          placeholder={t('aiProviders.routing.useProviderDefault', {
                            defaultValue: 'Use provider default',
                          })}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {globalModelOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('aiProviders.routing.chooseProviderFirst', {
                        defaultValue: 'Choose a provider to see available models.',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DetailSection>
        </Card>

        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('aiProviders.routing.pluginsTitle', { defaultValue: 'Per-plugin overrides' })}
            icon={Route}
            iconPlugin="ai-providers"
            subtleTitle
            className="p-4 sm:p-6"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              {t('aiProviders.routing.pluginsHint', {
                defaultValue:
                  'Optional. When set, a plugin uses its assigned provider instead of the global default.',
              })}
            </p>
            {pluginRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  {t('aiProviders.routing.noPlugins', {
                    defaultValue: 'No activated plugins available for AI routing.',
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pluginRows.map((plugin) => {
                  const draft = pluginDrafts[plugin.pluginKey] ?? { providerKey: '', model: '' };
                  const busy = savingPluginKey === plugin.pluginKey;
                  const savedProvider = plugin.providerKey ?? '';
                  const savedModel = plugin.model ?? '';
                  const hasUnsavedOverride =
                    draft.providerKey !== savedProvider || draft.model !== savedModel;
                  const modelOptions = draft.providerKey
                    ? modelOptionsForProvider(catalog, draft.providerKey, draft.model)
                    : [];
                  return (
                    <div key={plugin.pluginKey} className={PLUGIN_ROUTING_ROW_CLASS}>
                      <div className="min-w-[7rem] flex-1 basis-[7rem]">
                        <span className={PLUGIN_ROUTING_NAME_CLASS} title={plugin.label}>
                          {plugin.label}
                        </span>
                      </div>
                      <div className="min-w-[9rem] flex-1 basis-[9rem]">
                        <Label
                          className={PLUGIN_ROUTING_LABEL_CLASS}
                          htmlFor={`ai-routing-provider-${plugin.pluginKey}`}
                        >
                          {t('aiProviders.routing.provider', { defaultValue: 'Provider' })}
                        </Label>
                        <Select
                          value={draft.providerKey || GLOBAL_DEFAULT_VALUE}
                          disabled={busy}
                          onValueChange={(value) => {
                            const providerKey = value === GLOBAL_DEFAULT_VALUE ? '' : value;
                            const entry = catalog.find((item) => item.providerKey === providerKey);
                            setPluginDrafts((prev) => ({
                              ...prev,
                              [plugin.pluginKey]: {
                                providerKey,
                                model: providerKey ? (entry?.defaultModel ?? '') : '',
                              },
                            }));
                          }}
                        >
                          <SelectTrigger
                            id={`ai-routing-provider-${plugin.pluginKey}`}
                            className={cn(FORM_COMPACT_SELECT_CLASS, 'mt-1')}
                          >
                            <SelectValue
                              placeholder={t('aiProviders.routing.useGlobalDefault', {
                                defaultValue: 'Use global default',
                              })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={GLOBAL_DEFAULT_VALUE}>
                              {t('aiProviders.routing.useGlobalDefault', {
                                defaultValue: 'Use global default',
                              })}
                            </SelectItem>
                            {providersForPluginScope(plugin.pluginKey).map((provider) => (
                              <SelectItem key={provider.providerKey} value={provider.providerKey}>
                                {providerLabel(t, provider.providerKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {plugin.pluginKey === 'guides-audio' &&
                        providersForPluginScope(plugin.pluginKey).length === 0 ? (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {t('aiProviders.routing.noAudioGeneratableProviders', {
                              defaultValue:
                                'No audio-capable provider yet. TTS adapters will appear here when registered.',
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-[9rem] flex-1 basis-[9rem]">
                        <Label
                          className={PLUGIN_ROUTING_LABEL_CLASS}
                          htmlFor={`ai-routing-model-${plugin.pluginKey}`}
                        >
                          {t('aiProviders.defaultModel', { defaultValue: 'Default model' })}
                        </Label>
                        {draft.providerKey && modelOptions.length > 0 ? (
                          <Select
                            value={draft.model || NONE_VALUE}
                            disabled={busy}
                            onValueChange={(value) =>
                              setPluginDrafts((prev) => ({
                                ...prev,
                                [plugin.pluginKey]: {
                                  ...draft,
                                  model: value === NONE_VALUE ? '' : value,
                                },
                              }))
                            }
                          >
                            <SelectTrigger
                              id={`ai-routing-model-${plugin.pluginKey}`}
                              className={cn(FORM_COMPACT_SELECT_CLASS, 'mt-1')}
                            >
                              <SelectValue
                                placeholder={t('aiProviders.routing.useProviderDefault', {
                                  defaultValue: 'Use provider default',
                                })}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>
                                {t('aiProviders.routing.useProviderDefault', {
                                  defaultValue: 'Use provider default',
                                })}
                              </SelectItem>
                              {modelOptions.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="mt-1 flex h-7 items-center text-xs text-muted-foreground">
                            —
                          </p>
                        )}
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
                          disabled={!hasUnsavedOverride || !draft.providerKey || busy}
                          onClick={() => void handleSavePlugin(plugin)}
                        />
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
