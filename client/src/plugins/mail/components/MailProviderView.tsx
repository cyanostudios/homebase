import { Mail, Send } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_FIELD_LABEL_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';
import type { MailProviderSettings } from '../types/mail';

interface MailProviderViewProps {
  mail?: MailProviderSettings | null;
  item?: MailProviderSettings | null;
}

export const MailProviderView: React.FC<MailProviderViewProps> = ({ mail: mailProp, item }) => {
  const { currentMail } = useMail();
  const provider = mailProp ?? item ?? currentMail ?? null;
  const { t } = useTranslation();
  const { testProvider } = useMail();

  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testToInputRef = useRef<HTMLInputElement>(null);

  if (!provider) {
    return null;
  }

  const title = t(`mail.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(`mail.providers.${provider.providerKey}.settingsDescription`, {
    defaultValue: '',
  });

  const handleTest = async () => {
    if (!testTo.trim() || !testTo.includes('@')) {
      setTestError(t('mail.testEmailRequired', { defaultValue: 'Enter a valid email address' }));
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
        t('mail.testSent', {
          defaultValue: 'Test email sent ({{status}})',
          status: result.status,
        }),
      );
    } catch (err: unknown) {
      setTestError((err as Error)?.message || t('mail.testError', { defaultValue: 'Test failed' }));
    } finally {
      setTesting(false);
    }
  };

  return (
    <DetailLayout>
      <div className="space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
          <DetailSection title={title} icon={Mail} iconPlugin="mail" subtleTitle className="p-6">
            <p className="text-sm text-muted-foreground">{provider.providerKey}</p>
          </DetailSection>
        </Card>

        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
          <DetailSection
            title={t('mail.sectionDetails', { defaultValue: 'Configuration' })}
            icon={Mail}
            iconPlugin="mail"
            subtleTitle
            className="p-6"
          >
            {settingsDescription ? (
              <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
            ) : null}
            <div>
              <div className={DETAIL_FIELD_LABEL_CLASS}>
                {t('mail.credentials', { defaultValue: 'Credentials' })}
              </div>
              <p className="text-sm text-muted-foreground">
                {provider.configured
                  ? t('mail.keyConfigured', { defaultValue: 'Configured' })
                  : t('mail.keyMissing', { defaultValue: 'Missing' })}
                .{' '}
                {t('mail.settingsDescription', {
                  defaultValue: 'Configure credentials to send email from plugins.',
                })}
              </p>
            </div>
          </DetailSection>
        </Card>

        {provider.emailCapable ? (
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
            <DetailSection
              title={t('mail.testTitle', { defaultValue: 'Test settings' })}
              icon={Send}
              iconPlugin="mail"
              subtleTitle
              className="p-4 sm:p-6"
            >
              <p className="mb-3 text-sm text-muted-foreground">
                {t('mail.testHint', {
                  defaultValue: 'Send a test email using the saved credentials.',
                })}
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="mail-test-to">
                    {t('mail.sendTestTo', { defaultValue: 'Send test email to' })}
                  </Label>
                  <Input
                    ref={testToInputRef}
                    id="mail-test-to"
                    type="email"
                    className="mt-1"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="you@example.com"
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
                  {testing
                    ? t('mail.sending', { defaultValue: 'Sending...' })
                    : t('mail.sendTest', { defaultValue: 'Send test email' })}
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
