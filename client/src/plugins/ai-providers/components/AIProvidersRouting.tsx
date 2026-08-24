import { Route, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DetailSection } from '@/core/ui/DetailSection';

import { useAIProviders } from '../hooks/useAIProviders';
import type {
  PluginRoutingAssignment,
  ProviderCatalogEntry,
  SaveProviderRoutingInput,
} from '../types/aiProviders';

const NONE_VALUE = '__none__';
const GLOBAL_DEFAULT_VALUE = '__global__';

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

export const AIProvidersRouting: React.FC = () => {
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
    deletePluginRouting,
    closeRoutingView,
  } = useAIProviders();

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
  const [pluginDrafts, setPluginDrafts] = useState<
    Record<string, { providerKey: string; model: string }>
  >({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPluginKey, setSavingPluginKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
    void loadRouting();
  }, [loadSettings, loadRouting]);

  useEffect(() => {
    setGlobalProviderKey(routing?.global?.providerKey ?? '');
    setGlobalModel(routing?.global?.model ?? '');
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

  const handleClearPlugin = useCallback(
    async (pluginKey: string) => {
      setSavingPluginKey(pluginKey);
      setError(null);
      try {
        await deletePluginRouting(pluginKey);
        setPluginDrafts((prev) => ({
          ...prev,
          [pluginKey]: { providerKey: '', model: '' },
        }));
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
    [deletePluginRouting, t],
  );

  return (
    <div className="plugin-ai-providers min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('aiProviders.routing.title', { defaultValue: 'Provider routing' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('aiProviders.routing.description', {
                defaultValue:
                  'Set a global default provider and optional per-plugin overrides. Plugins request AI through routing — never a specific vendor directly.',
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={X}
            className="h-9 px-3 text-xs"
            onClick={closeRoutingView}
          >
            {t('common.close')}
          </Button>
        </div>

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5 p-4 shadow-none">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        ) : null}

        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection
            title={t('aiProviders.routing.globalTitle', { defaultValue: 'Global default' })}
            icon={Sparkles}
            iconPlugin="ai-providers"
            className="p-6"
          >
            <p className="mb-4 text-sm text-muted-foreground">
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
                  <SelectTrigger id="ai-routing-global-provider" className="mt-1">
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
                    <SelectTrigger id="ai-routing-global-model" className="mt-1">
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
            <div className="mt-4">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={savingGlobal || routingLoading || !globalProviderKey}
                onClick={() => void handleSaveGlobal()}
              >
                {savingGlobal
                  ? t('common.saving', { defaultValue: 'Saving…' })
                  : t('aiProviders.routing.saveGlobal', { defaultValue: 'Save global default' })}
              </Button>
            </div>
          </DetailSection>
        </Card>

        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection
            title={t('aiProviders.routing.pluginsTitle', { defaultValue: 'Per-plugin overrides' })}
            icon={Route}
            iconPlugin="ai-providers"
            className="p-6"
          >
            <p className="mb-4 text-sm text-muted-foreground">
              {t('aiProviders.routing.pluginsHint', {
                defaultValue:
                  'Optional. When set, a plugin uses its assigned provider instead of the global default.',
              })}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t('aiProviders.routing.plugin', { defaultValue: 'Plugin' })}
                  </TableHead>
                  <TableHead>
                    {t('aiProviders.routing.provider', { defaultValue: 'Provider' })}
                  </TableHead>
                  <TableHead>
                    {t('aiProviders.defaultModel', { defaultValue: 'Default model' })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(routing?.plugins ?? []).map((plugin) => {
                  const draft = pluginDrafts[plugin.pluginKey] ?? { providerKey: '', model: '' };
                  const modelOptions = draft.providerKey
                    ? modelOptionsForProvider(catalog, draft.providerKey, draft.model)
                    : [];
                  return (
                    <TableRow key={plugin.pluginKey}>
                      <TableCell className="font-medium">{plugin.label}</TableCell>
                      <TableCell>
                        <Select
                          value={draft.providerKey || GLOBAL_DEFAULT_VALUE}
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
                          <SelectTrigger className="min-w-[180px]">
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
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('aiProviders.routing.noAudioGeneratableProviders', {
                              defaultValue:
                                'No audio-capable provider yet. TTS adapters will appear here when registered.',
                            })}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {draft.providerKey && modelOptions.length > 0 ? (
                          <Select
                            value={draft.model || NONE_VALUE}
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
                            <SelectTrigger className="min-w-[180px]">
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
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!draft.providerKey || savingPluginKey === plugin.pluginKey}
                            onClick={() => void handleSavePlugin(plugin)}
                          >
                            {savingPluginKey === plugin.pluginKey
                              ? t('common.saving', { defaultValue: 'Saving…' })
                              : t('common.save', { defaultValue: 'Save' })}
                          </Button>
                          {plugin.providerKey ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={savingPluginKey === plugin.pluginKey}
                              onClick={() => void handleClearPlugin(plugin.pluginKey)}
                            >
                              {t('common.clear', { defaultValue: 'Clear' })}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DetailSection>
        </Card>
      </div>
    </div>
  );
};
