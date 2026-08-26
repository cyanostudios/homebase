import { Edit, Info, Mail, Send, Trash2, Zap } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
  const { openMailForEdit, deleteProvider, getDeleteMessage, testProvider } = useMail();

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProvider(provider.providerKey);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

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

  const focusTestForm = () => {
    testToInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    testToInputRef.current?.focus();
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
              <DetailSection
                title={t('mail.quickActions', { defaultValue: 'Quick actions' })}
                icon={Zap}
                iconPlugin="mail"
                subtleTitle
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Edit
                        {...props}
                        className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
                      />
                    )}
                    className={DETAIL_QUICK_ACTION_ROW_CLASS}
                    onClick={() => openMailForEdit(provider)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Trash2
                        {...props}
                        className={cn(props.className, 'text-red-600 dark:text-red-400')}
                      />
                    )}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setShowDelete(true)}
                  >
                    {t('common.delete')}
                  </Button>
                  {provider.emailCapable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={(props) => (
                        <Send
                          {...props}
                          className={cn(props.className, 'text-green-600 dark:text-green-400')}
                        />
                      )}
                      className={DETAIL_QUICK_ACTION_ROW_CLASS}
                      disabled={!provider.configured}
                      onClick={focusTestForm}
                    >
                      {t('mail.sendTest', { defaultValue: 'Send test email' })}
                    </Button>
                  ) : null}
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
              <DetailSection
                title={t('mail.information', { defaultValue: 'Information' })}
                icon={Info}
                iconPlugin="mail"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('mail.colProvider', { defaultValue: 'Provider' })}
                    </span>
                    <span className="font-extrabold text-foreground">{title}</span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('mail.providerKey', { defaultValue: 'Key' })}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {provider.providerKey}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('mail.enabled', { defaultValue: 'Enabled' })}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {provider.enabled ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('mail.capability', { defaultValue: 'Capability' })}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {provider.emailCapable
                        ? t('mail.emailCapable', { defaultValue: 'Email' })
                        : t('mail.notEmailCapable', { defaultValue: 'Not email capable' })}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('mail.credentials', { defaultValue: 'Credentials' })}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {provider.configured
                        ? t('mail.keyConfigured', { defaultValue: 'Configured' })
                        : t('mail.keyMissing', { defaultValue: 'Missing' })}
                    </span>
                  </div>
                  <div className={cn(DETAIL_INFO_ROW_CLASS, 'border-t border-border/50 pt-2')}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {provider.createdAt ? new Date(provider.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {provider.updatedAt ? new Date(provider.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
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

      <ConfirmDialog
        isOpen={showDelete}
        title={t('mail.deleteTitle', { defaultValue: 'Delete provider' })}
        message={getDeleteMessage(provider)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
        variant="danger"
        confirmDisabled={deleting}
      />
    </>
  );
};
