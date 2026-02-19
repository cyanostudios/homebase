import { Smartphone, Send } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';

type Provider = 'twilio' | 'mock';

interface PulseSettingsFormProps {
  onCancel?: () => void;
}

export const PulseSettingsForm: React.FC<PulseSettingsFormProps> = ({ onCancel }) => {
  const { t } = useTranslation();
  const { settings, loadSettings, saveSettings, testSettings, closePulsePanel } = usePulses();
  const userHasSelectedProvider = useRef(false);
  const [provider, setProvider] = useState<Provider>('twilio');
  const [, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');

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
        twilioAccountSid && !twilioAccountSid.startsWith('••••')
          ? twilioAccountSid.trim()
          : '';
      const token =
        twilioAuthToken && !twilioAuthToken.startsWith('••••')
          ? twilioAuthToken.trim()
          : '';
      await saveSettings({
        activeProvider: provider,
        twilioAccountSid: sid || undefined,
        twilioAuthToken: token || undefined,
        twilioFromNumber: (twilioFromNumber || '').trim() || undefined,
      });
      closePulsePanel();
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
    t,
  ]);

  useEffect(() => {
    const onSubmit = () => handleSave();
    const onCancelEv = () => onCancel?.();
    window.addEventListener('submitPulseForm', onSubmit);
    window.addEventListener('cancelPulseForm', onCancelEv);
    return () => {
      window.removeEventListener('submitPulseForm', onSubmit);
      window.removeEventListener('cancelPulseForm', onCancelEv);
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
        (provider === 'twilio' && (twilioAccountSid.startsWith('••••') || twilioAuthToken.startsWith('••••')));
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

  return (
    <div className="p-6 space-y-6">
      <Card className="shadow-none plugin-pulses p-6">
        <DetailSection title={t('pulses.settingsTitle')} icon={Smartphone}>
          <p className="text-sm text-muted-foreground mb-4">{t('pulses.settingsDescription')}</p>

          <div className="mb-4">
            <Label className="text-sm">{t('pulses.provider')}</Label>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button
                type="button"
                variant={provider === 'twilio' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  userHasSelectedProvider.current = true;
                  setProvider('twilio');
                }}
              >
                Twilio
              </Button>
              <Button
                type="button"
                variant={provider === 'mock' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  userHasSelectedProvider.current = true;
                  setProvider('mock');
                }}
              >
                Mock
              </Button>
              {settings && (
                <div className="flex flex-wrap items-center gap-2 ml-2 text-sm border-l border-border pl-3">
                  {settings.configured?.twilio && (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        settings.activeProvider === 'twilio'
                          ? 'plugin-pulses bg-plugin-subtle text-plugin border-plugin-subtle'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      Twilio{settings.activeProvider === 'twilio' ? ` • ${t('pulses.active')}` : ''}
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      settings.activeProvider === 'mock'
                        ? 'plugin-pulses bg-plugin-subtle text-plugin border-plugin-subtle'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    Mock{settings.activeProvider === 'mock' ? ` • ${t('pulses.active')}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {provider === 'twilio' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
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
          )}

          {provider === 'mock' && (
            <p className="text-sm text-muted-foreground">{t('pulses.mockDescription')}</p>
          )}

          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          {testSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">{testSuccess}</p>
          )}

          <DetailSection
            title={t('pulses.testTitle')}
            className="pt-4 mt-4 border-t border-border"
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
          </DetailSection>
        </DetailSection>
      </Card>
    </div>
  );
};
