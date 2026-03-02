import { LogIn, Shield, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';

type AuthMode = 'login' | 'signup';

export function LoginComponent() {
  const { login, verifyMfa, signup } = useApp();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('admin@homebase.se');
  const [password, setPassword] = useState('admin123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        // Client-side validation for signup
        if (!validateEmail(email)) {
          setError('Please enter a valid email address');
          setIsLoading(false);
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        const result = await signup(email, password);
        if (!result.success) {
          setError(result.error || 'Signup failed. Please try again.');
        }
        // If successful, user is auto-logged in by AppContext
      } else {
        // Login mode
        const result = await login(email, password);
        if (result === false) {
          setError('Invalid email or password');
        } else if (typeof result === 'object' && result.requiresMfa === true && result.mfaToken) {
          setMfaToken(result.mfaToken);
          setMfaCode('');
          setError(null);
        }
      }
    } catch {
      setError(
        mode === 'signup' ? 'Signup failed. Please try again.' : 'Login failed. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || !mfaCode.trim()) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const success = await verifyMfa(mfaToken, mfaCode.trim());
      if (!success) {
        setError('Invalid code');
      } else {
        setMfaToken(null);
        setMfaCode('');
      }
    } catch {
      setError('Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMfa = () => {
    setMfaToken(null);
    setMfaCode('');
    setError(null);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setMfaToken(null);
    setMfaCode('');
    setConfirmPassword('');
    // Clear demo credentials when switching to signup
    if (mode === 'login') {
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-border">
          <div className="sm:mx-auto sm:w-full sm:max-w-md mb-8">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
              Welcome to Homebase
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {mfaToken
                ? 'Enter your verification code'
                : mode === 'login'
                  ? 'Sign in to your account'
                  : 'Create your account'}
            </p>
          </div>

          {mfaToken ? (
            <form className="space-y-6" onSubmit={handleVerifyMfa}>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
                <p className="flex items-center gap-2">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <div>
                <label htmlFor="mfaCode" className="block text-sm font-medium text-foreground">
                  Verification code
                </label>
                <div className="mt-1">
                  <input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="appearance-none block w-full h-10 px-3 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={cancelMfa}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading || mfaCode.length !== 6}
                  className="flex-1"
                >
                  {isLoading ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email address
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
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full h-10 px-3 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder={
                      mode === 'signup' ? 'At least 8 characters' : 'Enter your password'
                    }
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-foreground"
                  >
                    Confirm Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none block w-full h-10 px-3 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="Confirm your password"
                    />
                  </div>
                </div>
              )}

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading}
                  className="w-full flex justify-center"
                >
                  {mode === 'login' ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {isLoading
                    ? mode === 'login'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'login'
                      ? 'Sign in'
                      : 'Sign up'}
                </Button>
              </div>
            </form>
          )}

          {!mfaToken && (
            <div className="mt-6">
              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-primary hover:text-primary/80 font-medium"
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && !mfaToken && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">Demo credentials</span>
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
