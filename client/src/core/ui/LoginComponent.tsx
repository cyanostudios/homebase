import { LogIn, UserPlus } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';

type AuthMode = 'login' | 'signup';

export function LoginComponent() {
  const { login, signup } = useApp();
  const [mode, setMode] = useState<AuthMode>('login');
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? 'admin@homebase.se' : '');
  const [password, setPassword] = useState(isDev ? 'admin123' : '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!result.success) {
          setError(result.error || 'Invalid email or password');
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

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
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
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

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
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
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
                icon={mode === 'login' ? LogIn : UserPlus}
                disabled={isLoading}
                className="w-full flex justify-center"
              >
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

          <div className="mt-6">
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={toggleMode}
                className="text-sm font-medium"
              >
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </Button>
            </div>
          </div>

          {mode === 'login' && isDev && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">Dev credentials</span>
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
