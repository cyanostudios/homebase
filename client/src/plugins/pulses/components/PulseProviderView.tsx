import { Send, Smartphone } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';

interface PulseProviderViewProps {
  pulse?: PulseProviderSettings | null;
  item?: PulseProviderSettings | null;
}

export const PulseProviderView: React.FC<PulseProviderViewProps> = ({ pulse: pulseProp, item }) => {
  const { currentPulse } = usePulses();
  const provider = pulseProp ?? item ?? currentPulse ?? null;
  const { t } = useTranslation();
  const { testProvider } = usePulses();

  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testToInputRef = useRef<HTMLInputElement>(null);

  if (!provider) {
    return null;
  }

  const title = t(`pulses.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(`pulses.providers.${provider.providerKey}.settingsDescription`, {
    defaultValue: '',
  });

  const handleTest = async () => {
    if (!testTo.trim()) {
      setTestError(t('pulses.testNumberRequired'));
      testToInputRef.current?.focus();
      return;
    }
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const result = await testProvider(provider.providerKey, {
        testTo: testTo.trim(),
        useSaved: true,
      });
      setTestMessage(
        t('pulses.testSent', {
          defaultValue: 'Test SMS sent ({{status}})',
          status: result.status,
        }),
      );
    } catch (err: unknown) {
      setTestError((err as Error)?.message || t('pulses.testError'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <DetailLayout>
      <div className="space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
          <DetailSection
            title={title}
            icon={Smartphone}
            iconPlugin="pulses"
            subtleTitle
            className="p-6"
          >
            <p className="text-sm text-muted-foreground">{provider.providerKey}</p>
          </DetailSection>
        </Card>

        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
          <DetailSection
            title={t('pulses.sectionDetails', { defaultValue: 'Configuration' })}
            icon={Smartphone}
            iconPlugin="pulses"
            subtleTitle
            className="p-6"
          >
            {settingsDescription ? (
              <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
            ) : null}
            {!provider.smsNotificationCapable ? (
              <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  {t('pulses.notSmsRoutableHint', {
                    defaultValue:
                      'Credentials only — not available for SMS routing in v1 (verify/OTP deferred).',
                  })}
                </p>
              </div>
            ) : (
              <div>
                <div className={DETAIL_FIELD_LABEL_CLASS}>{t('pulses.credentials')}</div>
                <p className="text-sm text-muted-foreground">
                  {provider.configured
                    ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                    : t('pulses.keyMissing', { defaultValue: 'Missing' })}
                  . {t('pulses.settingsDescription')}
                </p>
              </div>
            )}
          </DetailSection>
        </Card>

        {provider.smsNotificationCapable ? (
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
            <DetailSection
              title={t('pulses.testTitle')}
              icon={Send}
              iconPlugin="pulses"
              subtleTitle
              className="p-4 sm:p-6"
            >
              <p className="mb-3 text-sm text-muted-foreground">{t('pulses.testHint')}</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pulse-test-to">{t('pulses.sendTestTo')}</Label>
                  <Input
                    ref={testToInputRef}
                    id="pulse-test-to"
                    className="mt-1"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="+4670…"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Send}
                  className="h-9 px-3 text-xs"
                  disabled={testing || !provider.configured}
                  onClick={() => void handleTest()}
                >
                  {testing ? t('pulses.sending') : t('pulses.sendTest')}
                </Button>
                {testError ? (
                  <p className="text-sm text-destructive">{testError}</p>
                ) : testMessage ? (
                  <p className="text-sm text-green-600 dark:text-green-400">{testMessage}</p>
                ) : null}
              </div>
            </DetailSection>
          </Card>
        ) : null}
      </div>
    </DetailLayout>
  );
};
