import { Mail, Send } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { useMail } from '../hooks/useMail';
import type { SmtpSettings } from '../types/mail';

interface MailSettingsFormProps {
  currentItem?: any;
  onSave?: () => void;
  onCancel?: () => void;
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

export const MailSettingsForm: React.FC<MailSettingsFormProps> = ({ onCancel }) => {
  const { settings, loadSettings, saveSettings, testSettings, closeMailPanel } = useMail();
  const userHasSelectedProvider = useRef(false);
  const [provider, setProvider] = useState<Provider>('smtp');
  const [_saving, setSaving] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount only
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
      closeMailPanel();
    } catch (err: any) {
      setError(err?.message || 'Kunde inte spara inställningar');
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
      setError('Ange en giltig e-postadress att skicka testmail till');
      return;
    }
    setTesting(true);
    try {
      const payload =
        provider === 'resend'
          ? {
              testTo: email,
              provider: 'resend' as const,
              useSaved: false,
              resendApiKey: resendApiKey.startsWith('••••') ? undefined : resendApiKey,
              resendFromAddress: resendFromAddress.trim() || undefined,
            }
          : {
              testTo: email,
              provider: 'smtp' as const,
              useSaved: false,
              host: host.trim() || smtpDefaults.host,
              port: port || 587,
              secure,
              authUser: authUser.trim(),
              authPass: authPass.trim() || undefined,
              fromAddress: fromAddress.trim() || smtpDefaults.fromAddress,
            };
      await testSettings(payload);
      setTestSuccess('Testmail skickat! Kontrollera din inkorg.');
    } catch (err: any) {
      setError(err?.message || 'Kunde inte skicka testmail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5" />
          <h3 className="font-medium">E-postinställningar</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Välj leverantör och konfigurera för att skicka e-post från pluginet (t.ex. Besiktningar).
          Resend rekommenderas – säkrare och enklare med API-nyckel.
        </p>

        {/* Provider selector */}
        <div className="mb-4">
          <Label className="text-sm">Leverantör</Label>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Button
              type="button"
              variant={provider === 'resend' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                userHasSelectedProvider.current = true;
                setProvider('resend');
              }}
            >
              Resend
            </Button>
            <Button
              type="button"
              variant={provider === 'smtp' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                userHasSelectedProvider.current = true;
                setProvider('smtp');
              }}
            >
              SMTP
            </Button>
            {settings && (
              <div className="flex flex-wrap items-center gap-2 ml-2 text-sm border-l border-border pl-3">
                {settings.configured?.resend && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      settings.provider === 'resend'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Resend{settings.provider === 'resend' ? ' • Aktiv' : ''}
                  </span>
                )}
                {settings.configured?.smtp && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      settings.provider === 'smtp'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    SMTP{settings.provider === 'smtp' ? ' • Aktiv' : ''}
                  </span>
                )}
                {!settings.configured?.resend && !settings.configured?.smtp && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Aktiv: {settings.provider === 'resend' ? 'Resend' : 'SMTP'} (ej konfigurerad)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resend config */}
        {provider === 'resend' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hämta API-nyckel från{' '}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                resend.com
              </a>
            </p>
            <div>
              <Label htmlFor="resend-api-key">API-nyckel</Label>
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
              <Label htmlFor="resend-from">Avsändaradress (From)</Label>
              <Input
                id="resend-from"
                type="email"
                value={resendFromAddress}
                onChange={(e) => setResendFromAddress(e.target.value)}
                placeholder="onboarding@resend.dev eller din verifierade domän"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Resend kräver verifierad domän. Testa med onboarding@resend.dev.
              </p>
            </div>
          </div>
        )}

        {/* SMTP config */}
        {provider === 'smtp' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="smtp-host">Server (host)</Label>
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label htmlFor="smtp-port">Port</Label>
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
              <Label htmlFor="smtp-secure">Använd SSL/TLS (port 465)</Label>
            </div>
            <div>
              <Label htmlFor="smtp-user">Användarnamn</Label>
              <Input
                id="smtp-user"
                type="text"
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                placeholder="din@email.com"
              />
            </div>
            <div>
              <Label htmlFor="smtp-pass">Lösenord</Label>
              <Input
                id="smtp-pass"
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                placeholder={
                  settings?.smtp?.hasPassword ? 'Lämna tomt för att behålla befintligt' : ''
                }
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="smtp-from">Avsändaradress (From)</Label>
              <Input
                id="smtp-from"
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="noreply@homebase.se"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        {testSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">{testSuccess}</p>
        )}

        {/* Test section */}
        <div className="pt-4 mt-4 border-t border-border space-y-3">
          <h4 className="font-medium text-sm">Testa inställningar</h4>
          <p className="text-xs text-muted-foreground">
            Testa med fälten du fyllt i (spara behövs inte först).
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label htmlFor="test-to" className="text-sm">
                Skicka testmail till
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
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              <Send className="h-4 w-4" />
              {testing ? 'Skickar...' : 'Skicka testmail'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
