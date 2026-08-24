import { Mail, Route, X } from 'lucide-react';
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

import { useMail } from '../hooks/useMail';
import type { MailPluginRoutingAssignment, SaveMailRoutingInput } from '../types/mail';

function providerLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  providerKey: string,
) {
  return t(`mail.providers.${providerKey}.title`, { defaultValue: providerKey });
}

export const MailProvidersRouting: React.FC = () => {
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

  const emailRoutableProviders = useMemo(
    () =>
      providers.filter(
        (provider) => provider.enabled && provider.configured && provider.emailCapable,
      ),
    [providers],
  );

  const [globalProviderKey, setGlobalProviderKey] = useState('');
  const [pluginDrafts, setPluginDrafts] = useState<Record<string, string>>({});
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingPluginKey, setSavingPluginKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProviderSettings();
    void loadRouting();
  }, [loadProviderSettings, loadRouting]);

  useEffect(() => {
    setGlobalProviderKey(routing?.global?.providerKey ?? '');
    const next: Record<string, string> = {};
    for (const plugin of routing?.plugins ?? []) {
      next[plugin.pluginKey] = plugin.providerKey ?? '';
    }
    setPluginDrafts(next);
  }, [routing]);

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

  return (
    <div className="plugin-mail min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('mail.routing.title', { defaultValue: 'Email provider routing' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('mail.routing.description', {
                defaultValue:
                  'Set a global default email provider and optional per-plugin overrides. Only email-capable providers appear here.',
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
            title={t('mail.routing.globalTitle', { defaultValue: 'Global default' })}
            icon={Mail}
            iconPlugin="mail"
            className="p-6"
          >
            <p className="mb-4 text-sm text-muted-foreground">
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
                  : t('mail.routing.saveGlobal', { defaultValue: 'Save global default' })}
              </Button>
            </div>
          </DetailSection>
        </Card>

        <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <DetailSection
            title={t('mail.routing.pluginsTitle', { defaultValue: 'Per-plugin overrides' })}
            icon={Route}
            iconPlugin="mail"
            className="p-6"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('mail.routing.plugin', { defaultValue: 'Plugin' })}</TableHead>
                  <TableHead>{t('mail.routing.provider', { defaultValue: 'Provider' })}</TableHead>
                  <TableHead className="w-[200px]">
                    {t('common.actions', { defaultValue: 'Actions' })}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(routing?.plugins ?? []).map((plugin) => (
                  <TableRow key={plugin.pluginKey}>
                    <TableCell className="font-medium">{plugin.label}</TableCell>
                    <TableCell>
                      <Select
                        value={pluginDrafts[plugin.pluginKey] || undefined}
                        onValueChange={(value) =>
                          setPluginDrafts((prev) => ({ ...prev, [plugin.pluginKey]: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('mail.routing.inheritGlobal', {
                              defaultValue: 'Inherit global',
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
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={savingPluginKey === plugin.pluginKey || routingLoading}
                          onClick={() => void handleSavePlugin(plugin)}
                        >
                          {t('common.save')}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={
                            savingPluginKey === plugin.pluginKey ||
                            routingLoading ||
                            !plugin.providerKey
                          }
                          onClick={() => void handleClearPlugin(plugin.pluginKey)}
                        >
                          {t('mail.routing.clear', { defaultValue: 'Clear' })}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DetailSection>
        </Card>
      </div>
    </div>
  );
};
