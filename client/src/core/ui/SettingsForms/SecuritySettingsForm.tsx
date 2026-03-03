// client/src/core/ui/SettingsForms/SecuritySettingsForm.tsx
// Two-factor authentication (TOTP) settings

import { Shield } from 'lucide-react';
import React, { useCallback, useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';

interface SecuritySettingsFormProps {
  onCancel: () => void;
}

type SetupStep = 'idle' | 'qr' | 'verify' | 'success';

export function SecuritySettingsForm({ onCancel: _onCancel }: SecuritySettingsFormProps) {
  const { getMfaStatus, mfaSetup, mfaVerify, mfaDisable } = useApp();
  const [status, setStatus] = useState<{
    mfaEnabled: boolean;
    mfaDisabledInEnvironment?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await getMfaStatus();
      setStatus({
        mfaEnabled: res.mfaEnabled ?? false,
        mfaDisabledInEnvironment: res.mfaDisabledInEnvironment ?? false,
      });
    } catch (err) {
      console.error('Failed to load MFA status:', err);
      setStatus({ mfaEnabled: false });
    }
  }, [getMfaStatus]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await mfaSetup();
      setQrCodeDataUrl(res.qrCodeDataUrl ?? null);
      setManualSecret(res.secret ?? null);
      setSetupStep('qr');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to start setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim() || verifyCode.length !== 6) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await mfaVerify(verifyCode);
      setSetupStep('success');
      setVerifyCode('');
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupStep('idle');
    setQrCodeDataUrl(null);
    setManualSecret(null);
    setVerifyCode('');
    setError(null);
    loadStatus();
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword.trim()) {
      return;
    }
    setIsDisabling(true);
    setError(null);
    try {
      await mfaDisable(disablePassword);
      setShowDisableModal(false);
      setDisablePassword('');
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? 'Invalid password');
    } finally {
      setIsDisabling(false);
    }
  };

  if (status === null) {
    return <div className="p-6">Loading...</div>;
  }

  if (status.mfaDisabledInEnvironment) {
    return (
      <div className="space-y-6">
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title="Two-factor authentication">
            <p className="text-muted-foreground text-sm">
              Two-factor authentication is disabled in this environment.
            </p>
          </DetailSection>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Two-factor authentication">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          {setupStep === 'success' && (
            <div className="mb-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-3 py-2 rounded text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 flex-shrink-0" />
              Two-factor authentication has been enabled successfully.
            </div>
          )}

          {status.mfaEnabled ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Two-factor authentication is enabled.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDisableModal(true);
                  setError(null);
                }}
              >
                Disable two-factor authentication
              </Button>

              {showDisableModal && (
                <form
                  onSubmit={handleDisable}
                  className="mt-4 p-4 border border-border rounded-md space-y-3"
                >
                  <Label htmlFor="disable-password">Enter your password to disable</Label>
                  <Input
                    id="disable-password"
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowDisableModal(false);
                        setDisablePassword('');
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isDisabling || !disablePassword}
                    >
                      {isDisabling ? 'Disabling...' : 'Disable'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : setupStep === 'qr' || setupStep === 'verify' ? (
            <div className="space-y-4">
              {qrCodeDataUrl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy,
                    etc.):
                  </p>
                  <img
                    src={qrCodeDataUrl}
                    alt="QR code for authenticator"
                    className="w-48 h-48 border rounded"
                  />
                </div>
              )}
              {manualSecret && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Or enter this secret manually:
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                    {manualSecret}
                  </code>
                </div>
              )}
              <form onSubmit={handleVerifySetup} className="space-y-3">
                <Label htmlFor="mfa-verify-code">Enter 6-digit code from your app</Label>
                <Input
                  id="mfa-verify-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCancelSetup}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isLoading || verifyCode.length !== 6}
                  >
                    {isLoading ? 'Verifying...' : 'Verify and enable'}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security by requiring a verification code from your phone when
                signing in.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleStartSetup}
                disabled={isLoading}
              >
                {isLoading ? 'Starting...' : 'Enable two-factor authentication'}
              </Button>
            </div>
          )}
        </DetailSection>
      </Card>
    </div>
  );
}
