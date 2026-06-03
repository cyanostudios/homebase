import { ArrowLeft, LogIn, Mail, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { PasswordInput } from '@/core/ui/PasswordInput';
import { navPageToPath } from '@/core/routing/routeMap';

type AuthMode = 'login' | 'signup' | 'forgot';

export function LoginComponent() {
  const { t } = useTranslation();
  const { login, signup } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? 'admin@homebase.se' : '');
  const [password, setPassword] = useState(isDev ? 'admin123' : '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setForgotSent(false);
    setDevResetLink(null);

    if (!validateEmail(email)) {
      setError(t('auth.invalidEmail'));
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        devLink?: string;
      };
      if (!response.ok) {
        setError(data.error || t('auth.forgotFailed'));
        return;
      }
      setForgotSent(true);
      if (data.devLink) {
        setDevResetLink(data.devLink);
      }
    } catch {
      setError(t('auth.forgotFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot') {
      await handleForgotSubmit(e);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        if (!validateEmail(email)) {
          setError(t('auth.invalidEmail'));
          setIsLoading(false);
          return;
        }

        if (password.length < 8) {
          setError(t('auth.passwordMinLength'));
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError(t('auth.passwordsNoMatch'));
          setIsLoading(false);
          return;
        }

        const result = await signup(email, password);
        if (!result.success) {
          setError(result.error || t('auth.signupFailed'));
        } else {
          navigate(navPageToPath.dashboard, { replace: true });
        }
      } else {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || t('auth.loginFailed'));
        } else {
          navigate(navPageToPath.dashboard, { replace: true });
        }
      }
    } catch {
      setError(mode === 'signup' ? t('auth.signupFailed') : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setForgotSent(false);
    setDevResetLink(null);
    setConfirmPassword('');
    if (next === 'signup') {
      setEmail('');
      setPassword('');
    }
  };

  const title =
    mode === 'forgot'
      ? t('auth.forgotTitle')
      : mode === 'signup'
        ? t('auth.signupTitle')
        : t('auth.loginTitle');

  const subtitle =
    mode === 'forgot'
      ? t('auth.forgotSubtitle')
      : mode === 'signup'
        ? t('auth.signupSubtitle')
        : t('auth.loginSubtitle');

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">{title}</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {mode === 'forgot' && forgotSent ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded text-sm">
                {t('auth.forgotSent')}
              </div>
              {devResetLink && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs break-all">
                  <p className="font-medium text-foreground mb-1">{t('auth.forgotDevLink')}</p>
                  <a href={devResetLink} className="text-primary hover:underline">
                    {devResetLink}
                  </a>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                icon={ArrowLeft}
                className="w-full"
                onClick={() => switchMode('login')}
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
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  {t('auth.email')}
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full h-10 px-3 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="password" className="block text-sm font-medium text-foreground">
                      {t('auth.password')}
                    </label>
                    {mode === 'login' && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs font-medium"
                        onClick={() => switchMode('forgot')}
                      >
                        {t('auth.forgotPassword')}
                      </Button>
                    )}
                  </div>
                  <div className="mt-1">
                    <PasswordInput
                      key={mode}
                      id="password"
                      name="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'signup'
                          ? t('auth.passwordMinPlaceholder')
                          : t('auth.passwordPlaceholder')
                      }
                    />
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground"
                  >
                    {t('auth.confirmPassword')}
                  </label>
                  <div className="mt-1">
                    <PasswordInput
                      key="signup-confirm"
                      id="confirmPassword"
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  icon={mode === 'forgot' ? Mail : mode === 'login' ? LogIn : UserPlus}
                  disabled={isLoading}
                  className="w-full flex justify-center"
                >
                  {isLoading
                    ? mode === 'forgot'
                      ? t('auth.forgotSending')
                      : mode === 'login'
                        ? t('auth.signingIn')
                        : t('auth.signingUp')
                    : mode === 'forgot'
                      ? t('auth.forgotSubmit')
                      : mode === 'login'
                        ? t('auth.signIn')
                        : t('auth.signUp')}
                </Button>
              </div>
            </form>
          )}

          {!(mode === 'forgot' && forgotSent) && (
            <div className="mt-6 space-y-2">
              {mode === 'forgot' ? (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    icon={ArrowLeft}
                    onClick={() => switchMode('login')}
                    className="text-sm font-medium"
                  >
                    {t('auth.backToSignIn')}
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-sm font-medium"
                  >
                    {mode === 'login' ? t('auth.switchToSignup') : t('auth.switchToLogin')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === 'login' && isDev && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">
                    {t('auth.devCredentials')}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-center text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Email:</strong> admin@homebase.se
                </p>
                <p>
                  <strong className="text-foreground">Password:</strong> admin123
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
