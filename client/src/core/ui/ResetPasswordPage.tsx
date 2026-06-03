import { KeyRound } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/core/api/apiFetch';
import { PasswordInput } from '@/core/ui/PasswordInput';
import { navPageToPath } from '@/core/routing/routeMap';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }
    if (!token) {
      setError(t('auth.resetInvalidLink'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || t('auth.resetFailed'));
        return;
      }
      setDone(true);
    } catch {
      setError(t('auth.resetFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-extrabold text-foreground">{t('auth.resetTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('auth.resetSubtitle')}</p>
          </div>

          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-foreground">{t('auth.resetSuccess')}</p>
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => navigate(navPageToPath.dashboard, { replace: true })}
              >
                {t('auth.backToSignIn')}
              </Button>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {t('auth.newPassword')}
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder={t('auth.passwordMinPlaceholder')}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-foreground"
                >
                  {t('auth.confirmPassword')}
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                icon={KeyRound}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? t('auth.resetSaving') : t('auth.resetSubmit')}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              {t('auth.backToSignIn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
