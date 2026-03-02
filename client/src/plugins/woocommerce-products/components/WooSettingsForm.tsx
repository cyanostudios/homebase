// client/src/plugins/woocommerce-products/components/WooSettingsForm.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useWooCommerce } from '../context/WooCommerceContext';

export const WooSettingsForm: React.FC = () => {
  const {
    currentWooSettings,
    saveWooSettings,
    testWooConnection,
    isSaving,
    isTesting,
    validationErrors,
    clearValidationErrors,
    lastTestResult,
    closeWooSettingsPanel,
    panelMode,
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
    instanceKey: '',
    label: '',
  });
  const [labelRequiredError, setLabelRequiredError] = useState<string | null>(null);

  // Register unsaved-changes with global guard
  useEffect(() => {
    const key = `woo-settings-form`;
    registerUnsavedChangesChecker(key, () => isDirty);
    return () => unregisterUnsavedChangesChecker(key);
  }, [isDirty, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  // Initialize form from currentWooSettings (the item being edited) or settings (fallback)
  // Use currentWooSettings when panel is open, otherwise fall back to settings
  // But if panelMode is 'create' and currentWooSettings is null, use empty form
  useEffect(() => {
    // If creating a new store, always use empty form
    if (panelMode === 'create' && currentWooSettings === null) {
      resetForm();
      return;
    }

    // Otherwise, use currentWooSettings if available
    const sourceSettings = currentWooSettings;
    if (sourceSettings) {
      setFormData({
        storeUrl: sourceSettings.storeUrl || '',
        consumerKey: sourceSettings.consumerKey || '',
        consumerSecret: sourceSettings.consumerSecret || '',
        useQueryAuth: !!sourceSettings.useQueryAuth,
        instanceKey: (sourceSettings as any).instanceKey || '',
        label: (sourceSettings as any).label || '',
      });
      markClean();
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWooSettings, panelMode]);

  // Reset isDirty when switching to view mode
  useEffect(() => {
    if (panelMode === 'view') {
      markClean();
    }
  }, [panelMode, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
      storeUrl: '',
      consumerKey: '',
      consumerSecret: '',
      useQueryAuth: false,
      instanceKey: '',
      label: '',
    });
    markClean();
  }, [markClean]);

  const update = (k: string, v: any) => {
    setFormData((prev) => ({ ...prev, [k]: v }));
    if (k === 'label') {
      setLabelRequiredError(null);
    }
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);

  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const handleSave = useCallback(async () => {
    if (!formData.label || formData.label.trim() === '') {
      setLabelRequiredError('Butiksnamn (label) krävs.');
      return;
    }
    setLabelRequiredError(null);
    const ok = await saveWooSettings(formData);
    if (ok) {
      markClean();
    }
  }, [formData, saveWooSettings, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      // If creating a new store, just reset to empty form
      if (panelMode === 'create' && currentWooSettings === null) {
        resetForm();
      } else {
        const sourceSettings = currentWooSettings;
        if (sourceSettings) {
          setFormData({
            storeUrl: sourceSettings.storeUrl || '',
            consumerKey: sourceSettings.consumerKey || '',
            consumerSecret: sourceSettings.consumerSecret || '',
            useQueryAuth: !!sourceSettings.useQueryAuth,
            instanceKey: (sourceSettings as any).instanceKey || '',
            label: (sourceSettings as any).label || '',
          });
          markClean();
        } else {
          resetForm();
        }
      }
      // WooCommerce has no View component; always close panel so user returns to list page.
      closeWooSettingsPanel();
    });
  }, [attemptAction, currentWooSettings, resetForm, markClean, closeWooSettingsPanel, panelMode]);

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
                  <li key={e.field ?? `err-${i}`}>{e.message}</li>
                ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Settings fields */}
      <Card padding="sm" className="shadow-none px-0">
        <h3 className="text-lg font-semibold mb-3">WooCommerce Store</h3>
        <div className="space-y-3">
          <div>
            <Label htmlFor="label" className="mb-1">
              Store Name *
            </Label>
            <Input
              id="label"
              type="text"
              value={formData.label}
              onChange={(e) => update('label', e.target.value)}
              placeholder="My WooCommerce Store"
              required
              className={getFieldError('label') ? 'border-red-500' : ''}
            />
            {(getFieldError('label') || labelRequiredError) && (
              <p className="mt-1 text-sm text-red-600">
                {getFieldError('label')?.message ?? labelRequiredError}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Ge butiken ett namn så att den syns med rätt namn i orderlistan.
            </p>
          </div>

          <div>
            <Label htmlFor="storeUrl" className="mb-1">
              Store URL *
            </Label>
            <Input
              id="storeUrl"
              type="url"
              value={formData.storeUrl}
              onChange={(e) => update('storeUrl', e.target.value)}
              placeholder="https://your-store.example"
              required
              className={getFieldError('storeUrl') ? 'border-red-500' : ''}
            />
            {getFieldError('storeUrl') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('storeUrl')?.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="consumerKey" className="mb-1">
                Consumer Key *
              </Label>
              <Input
                id="consumerKey"
                type="text"
                value={formData.consumerKey}
                onChange={(e) => update('consumerKey', e.target.value)}
                required
                className={getFieldError('consumerKey') ? 'border-red-500' : ''}
              />
              {getFieldError('consumerKey') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('consumerKey')?.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="consumerSecret" className="mb-1">
                Consumer Secret *
              </Label>
              <Input
                id="consumerSecret"
                type="password"
                value={formData.consumerSecret}
                onChange={(e) => update('consumerSecret', e.target.value)}
                required
                className={getFieldError('consumerSecret') ? 'border-red-500' : ''}
              />
              {getFieldError('consumerSecret') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('consumerSecret')?.message}
                </p>
              )}
            </div>
          </div>

          <div>
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

          {panelMode === 'create' && (
            <div>
              <Label htmlFor="instanceKey" className="mb-1">
                Instance Key (optional)
              </Label>
              <Input
                id="instanceKey"
                type="text"
                value={formData.instanceKey}
                onChange={(e) => update('instanceKey', e.target.value)}
                placeholder="Auto-generated from store URL if not provided"
                className={getFieldError('instanceKey') ? 'border-red-500' : ''}
              />
              {getFieldError('instanceKey') && (
                <p className="mt-1 text-sm text-red-600">{getFieldError('instanceKey')?.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                A unique identifier for this store. If not provided, it will be generated from the
                store URL.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} variant="default" disabled={isSaving}>
            Save Settings
          </Button>
          <Button onClick={handleTest} variant="outline" disabled={isTesting}>
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
          <h4 className="text-base font-semibold mb-2">Connection Test</h4>
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
      />
    </div>
  );
};
