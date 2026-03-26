import { Check, Key, Send, Smartphone, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';

type Provider = 'twilio' | 'mock' | 'apple-messages';

interface PulseSettingsFormProps {
  onCancel?: () => void;
  /** When provided (e.g. from full-page settings), called after successful save instead of closePulsePanel */
  onSaveSuccess?: () => void;
}

export const PulseSettingsForm: React.FC<PulseSettingsFormProps> = ({
  onCancel,
  onSaveSuccess,
}) => {
  const { t } = useTranslation();
  const { settings, loadSettings, saveSettings, testSettings, closePulsePanel, pulseHistory } =
    usePulses();
  const [provider, setProvider] = useState<Provider>('twilio');
  const isAppleMessagesConfigured = settings?.configured?.appleMessages === true;
  const [, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');

  const pluginSources = useMemo(
    () =>
      Array.from(
        new Set(pulseHistory.map((e) => e.pluginSource).filter((ps): ps is string => !!ps)),
      ),
    [pulseHistory],
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setProvider((settings.activeProvider as Provider) || 'twilio');
      if (settings.twilio) {
        const tw = settings.twilio;
        setTwilioFromNumber(tw.fromNumber || '');
        setTwilioAccountSid(tw.hasAccountSid ? '••••••••' : '');
        setTwilioAuthToken(tw.hasAuthToken ? '••••••••' : '');
      }
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    setError(null);
    setTestSuccess(null);
    setSaving(true);
    try {
      const sid =
        twilioAccountSid && !twilioAccountSid.startsWith('••••') ? twilioAccountSid.trim() : '';
      const token =
        twilioAuthToken && !twilioAuthToken.startsWith('••••') ? twilioAuthToken.trim() : '';
      await saveSettings({
        activeProvider: provider,
        twilioAccountSid: sid || undefined,
        twilioAuthToken: token || undefined,
        twilioFromNumber: (twilioFromNumber || '').trim() || undefined,
      });
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        closePulsePanel();
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || t('pulses.saveError'));
    } finally {
      setSaving(false);
    }
  }, [
    provider,
    twilioAccountSid,
    twilioAuthToken,
    twilioFromNumber,
    saveSettings,
    closePulsePanel,
    onSaveSuccess,
    t,
  ]);

  useEffect(() => {
    window.submitPulsesForm = () => {
      void handleSave();
    };
    window.cancelPulsesForm = () => {
      onCancel?.();
    };
    // Compatibility aliases while older callers migrate.
    window.submitPulseForm = window.submitPulsesForm;
    window.cancelPulseForm = window.cancelPulsesForm;
    return () => {
      delete window.submitPulsesForm;
      delete window.cancelPulsesForm;
      delete window.submitPulseForm;
      delete window.cancelPulseForm;
    };
  }, [handleSave, onCancel]);

  const handleTest = async () => {
    setError(null);
    setTestSuccess(null);
    const to = testTo.trim();
    if (!to) {
      setError(t('pulses.testNumberRequired'));
      return;
    }
    setTesting(true);
    try {
      const twilioConfigured = settings?.configured?.twilio === true;
      const useSavedCredentials =
        twilioConfigured ||
        provider === 'apple-messages' ||
        (provider === 'twilio' &&
          (twilioAccountSid.startsWith('••••') || twilioAuthToken.startsWith('••••')));
      const payload: Record<string, unknown> = {
        testTo: to,
        activeProvider: provider,
        useSaved: useSavedCredentials,
      };
      if (provider === 'twilio' && !useSavedCredentials) {
        payload.twilioAccountSid = twilioAccountSid.startsWith('••••')
          ? undefined
          : twilioAccountSid.trim();
        payload.twilioAuthToken = twilioAuthToken.startsWith('••••')
          ? undefined
          : twilioAuthToken.trim();
        payload.twilioFromNumber = twilioFromNumber.trim();
      }
      await testSettings(payload as Parameters<typeof testSettings>[0]);
      setTestSuccess(t('pulses.testSent'));
    } catch (err: unknown) {
      setError((err as Error)?.message || t('pulses.testError'));
    } finally {
      setTesting(false);
    }
  };

  const isTwilioConfigured = settings?.configured?.twilio === true;

  const providerButtons: { id: Provider; label: string; isConfigured: boolean }[] = [
    { id: 'twilio', label: 'Twilio', isConfigured: isTwilioConfigured },
    {
      id: 'apple-messages',
      label: t('pulses.appleMessages'),
      isConfigured: isAppleMessagesConfigured,
    },
    { id: 'mock', label: 'Mock', isConfigured: true },
  ];

  return (
    <div className="plugin-pulses space-y-6 p-4">
      {/* Provider Section */}
      <DetailSection title={t('pulses.provider')} icon={Smartphone}>
        <p className="text-sm text-muted-foreground mb-4">{t('pulses.settingsDescription')}</p>
        <div className="flex gap-2 flex-wrap">
          {providerButtons.map(({ id, label, isConfigured }) => {
            const isActive = provider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setProvider(id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isConfigured ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                {label}
                {isActive && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </DetailSection>

      {/* Credentials Section - only for Twilio */}
      {provider === 'twilio' && (
        <DetailSection
          title={t('pulses.credentials')}
          icon={Key}
          className="border-t border-border pt-6"
        >
          <p className="text-sm text-muted-foreground mb-4">
            {t('pulses.twilioHint')}{' '}
            <a
              href="https://www.twilio.com/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              twilio.com/console
            </a>
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pulse-account-sid">{t('pulses.accountSid')}</Label>
              <Input
                id="pulse-account-sid"
                type="password"
                value={twilioAccountSid}
                onChange={(e) => setTwilioAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="pulse-auth-token">{t('pulses.authToken')}</Label>
              <Input
                id="pulse-auth-token"
                type="password"
                value={twilioAuthToken}
                onChange={(e) => setTwilioAuthToken(e.target.value)}
                placeholder={settings?.twilio?.hasAuthToken ? '••••••••' : ''}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="pulse-from-number">{t('pulses.fromNumber')}</Label>
              <Input
                id="pulse-from-number"
                type="tel"
                value={twilioFromNumber}
                onChange={(e) => setTwilioFromNumber(e.target.value)}
                placeholder="+46701234567"
              />
            </div>
          </div>
        </DetailSection>
      )}

      {/* Apple Messages description */}
      {provider === 'apple-messages' && (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">{t('pulses.appleMessagesDescription')}</p>
        </div>
      )}

      {/* Mock description */}
      {provider === 'mock' && (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">{t('pulses.mockDescription')}</p>
        </div>
      )}

      {/* Plugin Sources Section */}
      <DetailSection
        title={t('pulses.pluginSources')}
        icon={Zap}
        className="border-t border-border pt-6"
      >
        <p className="text-xs text-muted-foreground mb-3">{t('pulses.pluginSourcesHint')}</p>
        {pluginSources.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {pluginSources.map((ps) => (
              <Badge
                key={ps}
                variant="outline"
                className={cn(
                  'capitalize font-medium text-[10px]',
                  ps === 'contacts' &&
                    'plugin-contacts bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'slots' &&
                    'plugin-slots bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'notes' &&
                    'plugin-notes bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'tasks' &&
                    'plugin-tasks bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'estimates' &&
                    'plugin-estimates bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'invoices' &&
                    'plugin-invoices bg-plugin-subtle text-plugin border-plugin-subtle',
                  ps === 'files' &&
                    'plugin-files bg-plugin-subtle text-plugin border-plugin-subtle',
                )}
              >
                {ps}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">{t('pulses.noPluginSources')}</p>
        )}
      </DetailSection>

      {/* Test Section */}
      <DetailSection
        title={t('pulses.testTitle')}
        icon={Send}
        className="border-t border-border pt-6"
      >
        <p className="text-xs text-muted-foreground mb-3">{t('pulses.testHint')}</p>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="pulse-test-to" className="text-sm">
              {t('pulses.sendTestTo')}
            </Label>
            <Input
              id="pulse-test-to"
              type="tel"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="+46701234567"
              className="mt-1"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            icon={Send}
            className="h-9"
          >
            {testing ? t('pulses.sending') : t('pulses.sendTest')}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {testSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-3">{testSuccess}</p>
        )}
      </DetailSection>
    </div>
  );
};
