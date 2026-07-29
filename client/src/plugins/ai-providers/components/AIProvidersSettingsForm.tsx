import { Info, Key, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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

import { aiProvidersApi } from '../api/aiProvidersApi';
import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings, ProviderVoice } from '../types/aiProviders';
import {
  MASKED_SECRET,
  buildSavePayload,
  draftFromProvider,
  type ProviderDraft,
} from '../utils/providerFormHelpers';

interface AIProvidersSettingsFormProps {
  currentAIProvider?: ProviderSettings | null;
  onSave?: (data: Record<string, unknown>) => Promise<boolean>;
  onCancel?: () => void;
  onSaveSuccess?: () => void;
}

function buildDraftForProvider(
  provider: ProviderSettings | null | undefined,
  providerKey: string,
  defaultModel: string,
): ProviderDraft {
  if (provider) {
    return draftFromProvider(provider);
  }
  return {
    enabled: false,
    apiKey: '',
    defaultModel,
    voiceId: '',
    hasApiKey: false,
  };
}

export const AIProvidersSettingsForm = React.forwardRef<
  PanelFormHandle,
  AIProvidersSettingsFormProps
>(function AIProvidersSettingsForm(
  { currentAIProvider: currentAIProviderProp, onSave, onCancel, onSaveSuccess },
  ref,
) {
  const { t } = useTranslation();
  const {
    panelMode,
    currentAIProvider: currentFromContext,
    pendingProviderKey,
    setPendingProviderKey,
    catalog,
    providers,
    saveSettings,
  } = useAIProviders();

  const currentAIProvider = currentAIProviderProp ?? currentFromContext;

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

  const activeProviderKey = pendingProviderKey || currentAIProvider?.providerKey || '';
  const catalogEntry = catalog.find((entry) => entry.providerKey === activeProviderKey);
  const fallbackModel = catalogEntry?.defaultModel || currentAIProvider?.defaultModel || '';
  const catalogModels = catalogEntry?.models ?? [];

  const [draft, setDraft] = useState<ProviderDraft>(() =>
    buildDraftForProvider(currentAIProvider, activeProviderKey, fallbackModel),
  );
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<ProviderVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  const supportsVoice = activeProviderKey === 'elevenlabs';

  const modelOptions = useMemo(() => {
    const options = catalogModels.map((model) => ({
      id: model.id,
      label: model.label || model.id,
    }));
    const current = draft.defaultModel.trim();
    if (current && !options.some((option) => option.id === current)) {
      options.unshift({ id: current, label: current });
    }
    return options;
  }, [catalogModels, draft.defaultModel]);

  const voiceOptions = useMemo(() => {
    const options = voices.map((voice) => ({
      id: voice.id,
      label: voice.category ? `${voice.name} (${voice.category})` : voice.name,
    }));
    const current = draft.voiceId.trim();
    if (current && !options.some((option) => option.id === current)) {
      options.unshift({ id: current, label: current });
    }
    return options;
  }, [voices, draft.voiceId]);

  useEffect(() => {
    setDraft(buildDraftForProvider(currentAIProvider, activeProviderKey, fallbackModel));
    setError(null);
    setVoices([]);
    setVoicesError(null);
  }, [activeProviderKey, currentAIProvider, fallbackModel]);

  useEffect(() => {
    if (!supportsVoice) return;
    const canLoad =
      draft.hasApiKey || (draft.apiKey.trim() && !draft.apiKey.startsWith(MASKED_SECRET));
    if (!canLoad) {
      setVoices([]);
      return;
    }

    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError(null);

    const payload: { useSaved?: boolean; apiKey?: string } = {};
    if (draft.apiKey.trim() && !draft.apiKey.startsWith(MASKED_SECRET)) {
      payload.apiKey = draft.apiKey.trim();
      payload.useSaved = false;
    } else {
      payload.useSaved = true;
    }

    aiProvidersApi
      .listVoices(activeProviderKey, payload)
      .then((res) => {
        if (!cancelled) setVoices(res.voices || []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setVoices([]);
          setVoicesError(
            err instanceof Error
              ? err.message
              : t('aiProviders.voicesLoadError', {
                  defaultValue: 'Could not load voices. Enter a voice id manually.',
                }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supportsVoice, activeProviderKey, draft.hasApiKey, draft.apiKey, t]);

  const title = activeProviderKey
    ? t(`aiProviders.providers.${activeProviderKey}.title`, {
        defaultValue: activeProviderKey,
      })
    : t('aiProviders.chooseProvider', { defaultValue: 'Choose provider' });
  const settingsDescription = activeProviderKey
    ? t(`aiProviders.providers.${activeProviderKey}.settingsDescription`, {
        defaultValue: '',
      })
    : '';
  const docsUrl = activeProviderKey
    ? t(`aiProviders.providers.${activeProviderKey}.docsUrl`, { defaultValue: '' })
    : '';
  const docsLabel = activeProviderKey
    ? t(`aiProviders.providers.${activeProviderKey}.docsLabel`, { defaultValue: '' })
    : '';
  const apiKeyPlaceholder = activeProviderKey
    ? t(`aiProviders.providers.${activeProviderKey}.apiKeyPlaceholder`, {
        defaultValue: '',
      })
    : '';

  const handleSave = useCallback(async () => {
    if (!activeProviderKey) {
      setError(
        t('aiProviders.chooseProviderError', {
          defaultValue: 'Choose a provider type before saving.',
        }),
      );
      throw new Error('Provider type required');
    }

    setError(null);
    const payload = buildSavePayload(draft, fallbackModel);
    const saveData = { providerKey: activeProviderKey, ...payload };

    if (onSave) {
      const ok = await onSave(saveData);
      if (!ok) {
        setError(t('aiProviders.saveError', { defaultValue: 'Failed to save settings' }));
        throw new Error('Save failed');
      }
    } else {
      await saveSettings(activeProviderKey, payload);
    }
    onSaveSuccess?.();
  }, [activeProviderKey, draft, fallbackModel, onSave, onSaveSuccess, saveSettings, t]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => handleSave(),
      cancel: () => onCancel?.(),
    }),
    [handleSave, onCancel],
  );

  const enabledId = `ai-${activeProviderKey || 'new'}-enabled`;
  const apiKeyId = `ai-${activeProviderKey || 'new'}-api-key`;
  const modelId = `ai-${activeProviderKey || 'new'}-model`;
  const voiceId = `ai-${activeProviderKey || 'new'}-voice`;

  const formSidebar = currentAIProvider ? (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('aiProviders.information', { defaultValue: 'Information' })}
          icon={Info}
          iconPlugin="ai-providers"
          className="p-4"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('aiProviders.providerKey', { defaultValue: 'Key' })}
              </span>
              <span className="font-mono font-medium">{currentAIProvider.providerKey}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('common.created')}</span>
              <span className="font-medium">
                {currentAIProvider.createdAt
                  ? new Date(currentAIProvider.createdAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('common.updated')}</span>
              <span className="font-medium">
                {currentAIProvider.updatedAt
                  ? new Date(currentAIProvider.updatedAt).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  ) : undefined;

  return (
    <div className="plugin-ai-providers">
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
                title={t('aiProviders.providerType', { defaultValue: 'Provider type' })}
                icon={Sparkles}
                iconPlugin="ai-providers"
                className="p-6"
              >
                <div>
                  <Label htmlFor="ai-provider-type">
                    {t('aiProviders.chooseProvider', { defaultValue: 'Choose provider' })}
                  </Label>
                  <Select
                    value={activeProviderKey || undefined}
                    onValueChange={(value) => setPendingProviderKey(value)}
                  >
                    <SelectTrigger id="ai-provider-type" className="mt-1">
                      <SelectValue
                        placeholder={t('aiProviders.chooseProviderPlaceholder', {
                          defaultValue: 'Select a provider…',
                        })}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCatalog.map((entry) => {
                        const capabilityHints: string[] = [];
                        if (!entry.textGenerationCapable) {
                          capabilityHints.push(
                            t('aiProviders.notGeneratable', {
                              defaultValue: 'no text generation yet',
                            }),
                          );
                        }
                        if (!entry.audioGenerationCapable) {
                          capabilityHints.push(
                            t('aiProviders.notAudioGeneratable', {
                              defaultValue: 'no audio generation yet',
                            }),
                          );
                        }
                        return (
                          <SelectItem key={entry.providerKey} value={entry.providerKey}>
                            {t(`aiProviders.providers.${entry.providerKey}.title`, {
                              defaultValue: entry.providerKey,
                            })}
                            {capabilityHints.length ? ` (${capabilityHints.join('; ')})` : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {availableCatalog.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('aiProviders.allProvidersConfigured', {
                        defaultValue: 'All available provider types are already configured.',
                      })}
                    </p>
                  ) : null}
                </div>
              </DetailSection>
            </Card>
          ) : null}

          {activeProviderKey &&
          catalog.find((e) => e.providerKey === activeProviderKey)?.textGenerationCapable ===
            false ? (
            <Card className="border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t('aiProviders.notGeneratableHint', {
                  defaultValue:
                    'This provider can be saved for credentials, but Guides text generation only works with providers that have a registered adapter (currently OpenAI).',
                })}
              </p>
            </Card>
          ) : null}

          {activeProviderKey &&
          catalog.find((e) => e.providerKey === activeProviderKey)?.audioGenerationCapable ===
            false ? (
            <Card className="border-amber-500/40 bg-amber-500/5 p-4 shadow-none">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t('aiProviders.notAudioGeneratableHint', {
                  defaultValue:
                    'This provider can be saved for credentials, but Guides audio generation needs a registered TTS adapter (none yet — noop stub is used in prep).',
                })}
              </p>
            </Card>
          ) : null}

          {activeProviderKey ? (
            <>
              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={title}
                  icon={Sparkles}
                  iconPlugin="ai-providers"
                  className="p-6"
                >
                  {settingsDescription ? (
                    <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
                  ) : null}

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={enabledId}
                        checked={draft.enabled}
                        onCheckedChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
                      />
                      <Label htmlFor={enabledId}>
                        {t('aiProviders.enabled', { defaultValue: 'Enabled' })}
                      </Label>
                    </div>

                    <div>
                      <Label htmlFor={apiKeyId}>
                        {t('aiProviders.apiKey', { defaultValue: 'API Key' })}
                      </Label>
                      <Input
                        id={apiKeyId}
                        type="password"
                        value={draft.apiKey}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, apiKey: event.target.value }))
                        }
                        placeholder={
                          draft.hasApiKey ? MASKED_SECRET : apiKeyPlaceholder || undefined
                        }
                        autoComplete="new-password"
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('aiProviders.apiKeyHint', {
                          defaultValue:
                            'Leave unchanged to keep the stored key. Clear and save to remove it.',
                        })}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor={modelId}>
                        {t('aiProviders.defaultModel', { defaultValue: 'Default model' })}
                      </Label>
                      {modelOptions.length > 0 ? (
                        <Select
                          value={draft.defaultModel || fallbackModel || undefined}
                          onValueChange={(value) =>
                            setDraft((prev) => ({ ...prev, defaultModel: value }))
                          }
                        >
                          <SelectTrigger id={modelId} className="mt-1">
                            <SelectValue
                              placeholder={t('aiProviders.chooseModelPlaceholder', {
                                defaultValue: 'Select a model…',
                              })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {modelOptions.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={modelId}
                          type="text"
                          value={draft.defaultModel}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, defaultModel: event.target.value }))
                          }
                          placeholder={fallbackModel || undefined}
                          className="mt-1"
                        />
                      )}
                    </div>

                    {supportsVoice ? (
                      <div>
                        <Label htmlFor={voiceId}>
                          {t('aiProviders.voice', { defaultValue: 'Voice' })}
                        </Label>
                        {voiceOptions.length > 0 ? (
                          <Select
                            value={draft.voiceId || undefined}
                            onValueChange={(value) =>
                              setDraft((prev) => ({ ...prev, voiceId: value }))
                            }
                          >
                            <SelectTrigger id={voiceId} className="mt-1">
                              <SelectValue
                                placeholder={
                                  voicesLoading
                                    ? t('aiProviders.voicesLoading', {
                                        defaultValue: 'Loading voices…',
                                      })
                                    : t('aiProviders.chooseVoicePlaceholder', {
                                        defaultValue: 'Select a voice…',
                                      })
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {voiceOptions.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={voiceId}
                            type="text"
                            value={draft.voiceId}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, voiceId: event.target.value }))
                            }
                            placeholder={t('aiProviders.voiceIdPlaceholder', {
                              defaultValue: 'ElevenLabs voice id',
                            })}
                            className="mt-1"
                            disabled={voicesLoading}
                          />
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {voicesError ||
                            t('aiProviders.voiceHint', {
                              defaultValue:
                                'Used for Guides audio generation. Save after changing voice.',
                            })}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </DetailSection>
              </Card>

              {(docsUrl || docsLabel) && (
                <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                  <DetailSection
                    title={t('aiProviders.credentials', { defaultValue: 'Credentials' })}
                    icon={Key}
                    iconPlugin="ai-providers"
                    className="p-6"
                  >
                    <p className="text-xs text-muted-foreground">
                      {t('aiProviders.credentialsHint', {
                        defaultValue: 'Get an API key from',
                      })}{' '}
                      {docsUrl ? (
                        <a
                          href={docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          {docsLabel || docsUrl}
                        </a>
                      ) : (
                        docsLabel
                      )}
                    </p>
                  </DetailSection>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </DetailLayout>
    </div>
  );
});
