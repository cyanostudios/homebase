import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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
import {
  PluginSettingsPageShell,
  SettingsHeaderSaveButton,
  type PluginSettingsCategory,
} from '@/core/ui/PluginSettingsPageShell';
import { SETTINGS_CATEGORY_ICONS } from '@/core/ui/settingsCategoryIcons';

import { useMail } from '../hooks/useMail';
import type { MailPluginRoutingAssignment, SaveMailRoutingInput } from '../types/mail';

const GLOBAL_DEFAULT_VALUE = '__global__';

export type MailProvidersRoutingCategory = 'global' | 'plugins';

interface MailProvidersRoutingProps {
  selectedCategory?: MailProvidersRoutingCategory;
  onSelectedCategoryChange?: (category: MailProvidersRoutingCategory) => void;
  /** @deprecated Category buttons live in the settings header. Kept for call-site compatibility. */
  renderCategoryButtonsInline?: boolean;
  onClose?: () => void;
}

function providerLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  providerKey: string,
) {
  return t(`mail.providers.${providerKey}.title`, { defaultValue: providerKey });
}

export function MailProvidersRouting({
  selectedCategory,
  onSelectedCategoryChange,
  onClose,
}: MailProvidersRoutingProps = {}) {
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

  const [internalCategory, setInternalCategory] = useState<MailProvidersRoutingCategory>('global');
  const activeCategory = selectedCategory ?? internalCategory;
  const setActiveCategory = onSelectedCategoryChange ?? setInternalCategory;

  const [globalProviderKey, setGlobalProviderKey] = useState('');
  const [initialGlobalProviderKey, setInitialGlobalProviderKey] = useState('');
  const [pluginDrafts, setPluginDrafts] = useState<Record<string, string>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPluginKey, setSavingPluginKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const categories: PluginSettingsCategory[] = useMemo(
    () => [
      {
        id: 'global',
        label: t('mail.routing.categories.global', {
          defaultValue: 'Global default',
        }),
        description: t('mail.routing.globalHint', {
          defaultValue:
            'Used by any plugin without its own override. Only configured and enabled email providers are available.',
        }),
        icon: SETTINGS_CATEGORY_ICONS.routingGlobal,
      },
      {
        id: 'plugins',
        label: t('mail.routing.categories.plugins', {
          defaultValue: 'Per-plugin',
        }),
        description: t('mail.routing.pluginsHint', {
          defaultValue:
            'Optional. When set, a plugin uses its assigned provider instead of the global default.',
        }),
        icon: SETTINGS_CATEGORY_ICONS.routingPlugins,
      },
    ],
    [t],
  );

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

  const isDirty = activeCategory === 'global' && globalProviderKey !== initialGlobalProviderKey;

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

  return (
    <PluginSettingsPageShell
      title={t('mail.routing.title', { defaultValue: 'Mail – Routing' })}
      subtitle={t('mail.routing.description', {
        defaultValue:
          'Set a global default email provider and optional per-plugin overrides. Only email-capable providers appear here.',
      })}
      categories={categories}
      activeCategory={activeCategory}
      onCategoryChange={(id) => setActiveCategory(id as MailProvidersRoutingCategory)}
      onClose={handleClose}
      onSave={isDirty ? () => void handleSaveGlobal() : undefined}
      isSaving={savingGlobal}
      saveAction={
        isDirty ? (
          <SettingsHeaderSaveButton
            onClick={() => void handleSaveGlobal()}
            isSaving={savingGlobal}
            disabled={!globalProviderKey}
            label={t('common.save', { defaultValue: 'Save' })}
            savingLabel={t('common.saving', { defaultValue: 'Saving…' })}
          />
        ) : null
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {activeCategory === 'global' ? (
        <DetailSection
          title={t('mail.routing.globalTitle', { defaultValue: 'Global default' })}
          className="pt-0"
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
                <SelectTrigger id="mail-routing-global-provider" className="mt-1">
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
                    defaultValue: 'Enable SMTP or Resend with credentials — then it appears here.',
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </DetailSection>
      ) : null}

      {activeCategory === 'plugins' ? (
        <DetailSection
          title={t('mail.routing.pluginsTitle', { defaultValue: 'Per-plugin overrides' })}
          className="pt-0"
        >
          <p className="mb-4 text-sm text-muted-foreground">
            {t('mail.routing.pluginsHint', {
              defaultValue:
                'Optional. When set, a plugin uses its assigned provider instead of the global default.',
            })}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mail.routing.plugin', { defaultValue: 'Plugin' })}</TableHead>
                <TableHead>{t('mail.routing.provider', { defaultValue: 'Provider' })}</TableHead>
                <TableHead className="text-right">
                  {t('common.actions', { defaultValue: 'Actions' })}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(routing?.plugins ?? []).map((plugin) => {
                const draft = pluginDrafts[plugin.pluginKey] ?? '';
                return (
                  <TableRow key={plugin.pluginKey}>
                    <TableCell className="font-medium">{plugin.label}</TableCell>
                    <TableCell>
                      <Select
                        value={draft || GLOBAL_DEFAULT_VALUE}
                        onValueChange={(value) => {
                          const providerKey = value === GLOBAL_DEFAULT_VALUE ? '' : value;
                          setPluginDrafts((prev) => ({
                            ...prev,
                            [plugin.pluginKey]: providerKey,
                          }));
                        }}
                      >
                        <SelectTrigger className="min-w-[180px]">
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
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!draft || savingPluginKey === plugin.pluginKey}
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
      ) : null}
    </PluginSettingsPageShell>
  );
}
