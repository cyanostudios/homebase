// client/src/plugins/woocommerce-products/components/WooSettingsForm.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading, Text } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useWooCommerce } from '../context/WooCommerceContext';

export const WooSettingsForm: React.FC = () => {
  const {
    settings,
    saveWooSettings,
    testWooConnection,
    isSaving,
    isTesting,
    validationErrors,
    clearValidationErrors,
    lastTestResult,
    // NEW: use context-controlled navigation
    openWooSettingsForView,
    closeWooSettingsPanel,
  } = useWooCommerce();

  const {
    isDirty,
    showWarning,
    markDirty,
    markClean,
    attemptAction,
    confirmDiscard,
    cancelDiscard,
  } = useUnsavedChanges();
  const { registerUnsavedChangesChecker, unregisterUnsavedChangesChecker } =
    useGlobalNavigationGuard();

  const [formData, setFormData] = useState({
    storeUrl: '',
    consumerKey: '',
    consumerSecret: '',
    useQueryAuth: false,
  });

  // Register unsaved-changes with global guard
  useEffect(() => {
    const key = `woo-settings-form`;
    registerUnsavedChangesChecker(key, () => isDirty);
    return () => unregisterUnsavedChangesChecker(key);
  }, [isDirty, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Initialize form from saved settings
  useEffect(() => {
    if (settings) {
      setFormData({
        storeUrl: settings.storeUrl || '',
        consumerKey: settings.consumerKey || '',
        consumerSecret: settings.consumerSecret || '',
        useQueryAuth: !!settings.useQueryAuth,
      });
      markClean();
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const resetForm = useCallback(() => {
    setFormData({ storeUrl: '', consumerKey: '', consumerSecret: '', useQueryAuth: false });
    markClean();
  }, [markClean]);

  const update = (k: string, v: any) => {
    setFormData((prev) => ({ ...prev, [k]: v }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const handleSave = useCallback(async () => {
    const ok = await saveWooSettings(formData);
    if (ok) {
      markClean();
    } // provider will set panelMode('view')
  }, [formData, saveWooSettings, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      if (settings) {
        // Revert and return to view mode
        setFormData({
          storeUrl: settings.storeUrl || '',
          consumerKey: settings.consumerKey || '',
          consumerSecret: settings.consumerSecret || '',
          useQueryAuth: !!settings.useQueryAuth,
        });
        markClean();
        openWooSettingsForView(settings);
      } else {
        // New/create: reset and close the panel
        resetForm();
        closeWooSettingsPanel();
      }
    });
  }, [
    attemptAction,
    settings,
    resetForm,
    markClean,
    openWooSettingsForView,
    closeWooSettingsPanel,
  ]);

  const handleTest = useCallback(async () => {
    await testWooConnection(formData);
  }, [testWooConnection, formData]);

  // IMPORTANT: bind global submit/cancel to the *latest* handlers
  useEffect(() => {
    const onSubmit = () => handleSave();
    const onCancelEv = () => handleCancel();
    window.addEventListener('submitWooSettingsForm', onSubmit as EventListener);
    window.addEventListener('cancelWooSettingsForm', onCancelEv as EventListener);
    return () => {
      window.removeEventListener('submitWooSettingsForm', onSubmit as EventListener);
      window.removeEventListener('cancelWooSettingsForm', onCancelEv as EventListener);
    };
  }, [handleSave, handleCancel]);

  const testSummary = useMemo(() => {
    if (!lastTestResult) {
      return null;
    }
    return (
      <div
        className={`rounded-md p-3 border ${lastTestResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">
              {lastTestResult.ok ? 'Connection OK' : 'Connection Failed'}
            </span>
            <span className="ml-2 text-gray-600">
              ({lastTestResult.status} {lastTestResult.statusText})
            </span>
          </div>
          <code className="text-xs">{lastTestResult.endpoint}</code>
        </div>
        <pre className="mt-2 text-xs overflow-auto max-h-48 bg-white/60 p-2 rounded">
          {JSON.stringify(lastTestResult.body, null, 2)}
        </pre>
      </div>
    );
  }, [lastTestResult]);

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      {hasBlockingErrors && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800 font-medium">Cannot save settings</div>
            <ul className="list-disc list-inside mt-2 text-sm text-red-700">
              {validationErrors
                .filter((e) => !e.message.includes('Warning'))
                .map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Settings fields */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          WooCommerce Store
        </Heading>
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store URL</label>
            <input
              type="url"
              value={formData.storeUrl}
              onChange={(e) => update('storeUrl', e.target.value)}
              placeholder="https://your-store.example"
              className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('storeUrl') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('storeUrl') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('storeUrl')?.message}</p>
            )}
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Key</label>
            <input
              type="text"
              value={formData.consumerKey}
              onChange={(e) => update('consumerKey', e.target.value)}
              className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('consumerKey') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('consumerKey') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('consumerKey')?.message}</p>
            )}
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Consumer Secret</label>
            <input
              type="password"
              value={formData.consumerSecret}
              onChange={(e) => update('consumerSecret', e.target.value)}
              className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('consumerSecret') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('consumerSecret') && (
              <p className="mt-1 text-sm text-red-600">
                {getFieldError('consumerSecret')?.message}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.useQueryAuth}
                onChange={(e) => update('useQueryAuth', e.target.checked)}
              />
              Use query auth (?consumer_key=…&consumer_secret=…) instead of Basic (for non-HTTPS
              dev).
            </label>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} variant="primary" disabled={isSaving}>
            Save Settings
          </Button>
          <Button onClick={handleTest} variant="secondary" disabled={isTesting}>
            Test Connection
          </Button>
          <Button onClick={handleCancel} variant="ghost">
            Cancel
          </Button>
        </div>
      </Card>

      {/* Test result */}
      {lastTestResult && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={4} className="mb-2">
            Connection Test
          </Heading>
          {testSummary}
        </Card>
      )}

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message="You have unsaved changes. Discard them?"
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
