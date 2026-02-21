import { Check, Key, Mail, Send } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DetailSection } from '@/core/ui/DetailSection';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';
import type { SmtpSettings } from '../types/mail';

interface MailSettingsFormProps {
  currentItem?: any;
  onSave?: () => void;
  onCancel?: () => void;
  /** When provided (e.g. from full-page settings), called after successful save instead of closeMailPanel */
  onSaveSuccess?: () => void;
}

type Provider = 'smtp' | 'resend';

const smtpDefaults: SmtpSettings = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  authUser: '',
  fromAddress: 'noreply@homebase.se',
  hasPassword: false,
};

export const MailSettingsForm: React.FC<MailSettingsFormProps> = ({ onCancel, onSaveSuccess }) => {
  const { t } = useTranslation();
  const { settings, loadSettings, saveSettings, testSettings, closeMailPanel } = useMail();
  const [provider, setProvider] = useState<Provider>('smtp');
  const [, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  // SMTP state
  const [host, setHost] = useState(smtpDefaults.host);
  const [port, setPort] = useState(smtpDefaults.port);
  const [secure, setSecure] = useState(smtpDefaults.secure);
  const [authUser, setAuthUser] = useState(smtpDefaults.authUser);
  const [authPass, setAuthPass] = useState('');
  const [fromAddress, setFromAddress] = useState(smtpDefaults.fromAddress);

  // Resend state
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromAddress, setResendFromAddress] = useState('');

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (settings) {
      setProvider((settings.provider as Provider) || 'smtp');
      if (settings.smtp) {
        const s = settings.smtp;
        setHost(s.host || smtpDefaults.host);
        setPort(s.port ?? smtpDefaults.port);
        setSecure(s.secure ?? smtpDefaults.secure);
        setAuthUser(s.authUser || '');
        setFromAddress(s.fromAddress || smtpDefaults.fromAddress);
      }
      if (settings.resend) {
        const r = settings.resend;
        setResendFromAddress(r.fromAddress || '');
        setResendApiKey(r.hasApiKey ? '••••••••' : '');
      }
    }
    setAuthPass('');
  }, [settings]);

  const handleSave = useCallback(async () => {
    setError(null);
    setTestSuccess(null);
    setSaving(true);
    try {
      await saveSettings({
        provider,
        host: host.trim() || smtpDefaults.host,
        port: port || 587,
        secure,
        authUser: authUser.trim(),
        authPass: authPass.trim() || undefined,
        fromAddress: fromAddress.trim() || smtpDefaults.fromAddress,
        resendApiKey: resendApiKey.startsWith('••••')
          ? undefined
          : resendApiKey.trim() || undefined,
        resendFromAddress: resendFromAddress.trim() || undefined,
      });
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        closeMailPanel();
      }
    } catch (err: any) {
      setError(err?.message || t('mail.saveError'));
    } finally {
      setSaving(false);
    }
  }, [
    provider,
    host,
    port,
    secure,
    authUser,
    authPass,
    fromAddress,
    resendApiKey,
    resendFromAddress,
    saveSettings,
    closeMailPanel,
    onSaveSuccess,
    t,
  ]);

  useEffect(() => {
    const onSubmit = () => handleSave();
    const onCancelEv = () => onCancel?.();
    window.addEventListener('submitMailForm', onSubmit);
    window.addEventListener('cancelMailForm', onCancelEv);
    return () => {
      window.removeEventListener('submitMailForm', onSubmit);
      window.removeEventListener('cancelMailForm', onCancelEv);
    };
  }, [handleSave, onCancel]);

  const handleTest = async () => {
    setError(null);
    setTestSuccess(null);
    const email = testTo.trim();
    if (!email || !email.includes('@')) {
      setError(t('mail.testEmailRequired'));
      return;
    }
    setTesting(true);
    try {
      const payload: Record<string, unknown> = {
        testTo: email,
        provider,
      };

      if (provider === 'resend') {
        const hasNewKey = resendApiKey && !resendApiKey.startsWith('••••');
        if (hasNewKey) {
          payload.useSaved = false;
          payload.resendApiKey = resendApiKey.trim();
          payload.resendFromAddress = resendFromAddress.trim() || undefined;
        } else if (isResendConfigured) {
          payload.useSaved = true;
        } else {
          setError(t('mail.apiKeyRequired'));
          setTesting(false);
          return;
        }
      } else {
        const hasNewPassword = authPass && authPass.trim() !== '';
        if (hasNewPassword || !settings?.smtp?.hasPassword) {
          payload.useSaved = false;
          payload.host = host.trim() || smtpDefaults.host;
          payload.port = port || 587;
          payload.secure = secure;
          payload.authUser = authUser.trim();
          payload.authPass = authPass.trim() || undefined;
          payload.fromAddress = fromAddress.trim() || smtpDefaults.fromAddress;
        } else if (isSmtpConfigured) {
          payload.useSaved = true;
        } else {
          payload.useSaved = false;
          payload.host = host.trim() || smtpDefaults.host;
          payload.port = port || 587;
          payload.secure = secure;
          payload.authUser = authUser.trim();
          payload.fromAddress = fromAddress.trim() || smtpDefaults.fromAddress;
        }
      }

      await testSettings(payload as any);
      setTestSuccess(t('mail.testSent'));
    } catch (err: any) {
      setError(err?.message || t('mail.testError'));
    } finally {
      setTesting(false);
    }
  };

  const isResendConfigured = settings?.configured?.resend === true;
  const isSmtpConfigured = settings?.configured?.smtp === true;

  return (
    <div className="plugin-mail space-y-6 p-4">
      {/* Provider Section */}
      <DetailSection title={t('mail.provider')} icon={Mail}>
        <p className="text-sm text-muted-foreground mb-4">{t('mail.settingsDescription')}</p>
        <div className="flex gap-2">
          {(['resend', 'smtp'] as const).map((p) => {
            const isConfigured = p === 'resend' ? isResendConfigured : isSmtpConfigured;
            const isActive = provider === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
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
                {p === 'resend' ? 'Resend' : 'SMTP'}
                {isActive && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </DetailSection>

      {/* Credentials Section - Resend */}
      {provider === 'resend' && (
        <DetailSection
          title={t('mail.credentials')}
          icon={Key}
          className="border-t border-border pt-6"
        >
          <p className="text-sm text-muted-foreground mb-4">
            {t('mail.resendHint')}{' '}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              resend.com
            </a>
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resend-api-key">{t('mail.apiKey')}</Label>
              <Input
                id="resend-api-key"
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_xxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="resend-from">{t('mail.fromAddress')}</Label>
              <Input
                id="resend-from"
                type="email"
                value={resendFromAddress}
                onChange={(e) => setResendFromAddress(e.target.value)}
                placeholder={t('mail.resendFromPlaceholder')}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('mail.resendDomainHint')}</p>
            </div>
          </div>
        </DetailSection>
      )}

      {/* Credentials Section - SMTP */}
      {provider === 'smtp' && (
        <DetailSection
          title={t('mail.credentials')}
          icon={Key}
          className="border-t border-border pt-6"
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="smtp-host">{t('mail.host')}</Label>
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="smtp-port">{t('mail.port')}</Label>
              <Input
                id="smtp-port"
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 587)}
                placeholder="587"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="smtp-secure" checked={secure} onCheckedChange={setSecure} />
              <Label htmlFor="smtp-secure">{t('mail.secure')}</Label>
            </div>
            <div>
              <Label htmlFor="smtp-user">{t('mail.authUser')}</Label>
              <Input
                id="smtp-user"
                type="text"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                placeholder="din@email.com"
              />
            </div>
            <div>
              <Label htmlFor="smtp-pass">{t('mail.password')}</Label>
              <Input
                id="smtp-pass"
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                placeholder={settings?.smtp?.hasPassword ? t('mail.passwordPlaceholder') : ''}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="smtp-from">{t('mail.fromAddress')}</Label>
              <Input
                id="smtp-from"
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="noreply@homebase.se"
              />
            </div>
          </div>
        </DetailSection>
      )}

      {/* Test Section */}
      <DetailSection
        title={t('mail.testTitle')}
        icon={Send}
        className="border-t border-border pt-6"
      >
        <p className="text-xs text-muted-foreground mb-3">{t('mail.testHint')}</p>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="test-to" className="text-sm">
              {t('mail.sendTestTo')}
            </Label>
            <Input
              id="test-to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="din@email.com"
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
            {testing ? t('mail.sending') : t('mail.sendTest')}
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
