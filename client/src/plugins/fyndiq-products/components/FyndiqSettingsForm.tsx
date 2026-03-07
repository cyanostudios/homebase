import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Heading } from '@/core/ui/Typography';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import { useFyndiqProducts } from '../context/FyndiqProductsContext';

export const FyndiqSettingsForm: React.FC = () => {
  const {
    settings,
    saveFyndiqSettings,
    testFyndiqConnection,
    isSaving,
    isTesting,
    validationErrors,
    clearValidationErrors,
    lastTestResult,
    openFyndiqSettingsForView: _openFyndiqSettingsForView,
    closeFyndiqSettingsPanel,
  } = useFyndiqProducts();

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
    apiKey: '',
    apiSecret: '',
  });

  useEffect(() => {
    const key = `fyndiq-settings-form`;
    registerUnsavedChangesChecker(key, () => isDirty);
    return () => unregisterUnsavedChangesChecker(key);
  }, [isDirty, registerUnsavedChangesChecker, unregisterUnsavedChangesChecker]);

  useEffect(() => {
    if (settings) {
      setFormData({
        apiKey: settings.apiKey || '',
        apiSecret: settings.apiSecret || '',
      });
      markClean();
    } else {
      setFormData({ apiKey: '', apiSecret: '' });
      markClean();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const update = (k: 'apiKey' | 'apiSecret', v: string) => {
    setFormData((prev) => ({ ...prev, [k]: v }));
    markDirty();
    clearValidationErrors();
  };

  const getFieldError = (field: string) => validationErrors.find((e) => e.field === field);
  const hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'));

  const handleSave = useCallback(async () => {
    const ok = await saveFyndiqSettings(formData as any);
    if (ok) {
      markClean();
    }
  }, [formData, saveFyndiqSettings, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      if (settings) {
        setFormData({ apiKey: settings.apiKey || '', apiSecret: settings.apiSecret || '' });
        markClean();
        // Switch to view mode by setting panel mode, don't call openFyndiqSettingsForView
        // since Fyndiq doesn't have a View component - just close the panel
        closeFyndiqSettingsPanel();
      } else {
        setFormData({ apiKey: '', apiSecret: '' });
        markClean();
        closeFyndiqSettingsPanel();
      }
    });
  }, [attemptAction, settings, markClean, closeFyndiqSettingsPanel]);

  const handleTest = useCallback(async () => {
    await testFyndiqConnection(formData as any);
  }, [testFyndiqConnection, formData]);

  useEffect(() => {
    const onSubmit = () => void handleSave();
    const onCancelEv = () => void handleCancel();
    window.addEventListener('submitFyndiqSettingsForm', onSubmit as EventListener);
    window.addEventListener('cancelFyndiqSettingsForm', onCancelEv as EventListener);
    return () => {
      window.removeEventListener('submitFyndiqSettingsForm', onSubmit as EventListener);
      window.removeEventListener('cancelFyndiqSettingsForm', onCancelEv as EventListener);
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
        <div className="text-sm font-medium">
          {lastTestResult.ok ? 'Connection OK' : 'Connection Failed'}
        </div>
        <div className="mt-1 text-xs text-gray-700">
          {lastTestResult.message || lastTestResult.error || '—'}
        </div>
      </div>
    );
  }, [lastTestResult]);

  return (
    <div className="space-y-4">
      {hasBlockingErrors && (
        <Card padding="sm" className="shadow-none px-0">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800 font-medium">Cannot save settings</div>
            <ul className="list-disc list-inside mt-2 text-sm text-red-700">
              {validationErrors
                .filter((e) => !e.message.includes('Warning'))
                .map((e) => (
                  <li key={e.field + ':' + e.message}>{e.message}</li>
                ))}
            </ul>
          </div>
        </Card>
      )}

      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3">
          Fyndiq Login
        </Heading>
        <div className="space-y-3">
          <div>
            <Label htmlFor="apiKey" className="mb-1">
              User *
            </Label>
            <Input
              id="apiKey"
              type="text"
              value={formData.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              required
              placeholder="Your Fyndiq user / merchant id"
              className={getFieldError('apiKey') ? 'border-red-500' : ''}
            />
            {getFieldError('apiKey') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('apiKey')?.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="apiSecret" className="mb-1">
              Password *
            </Label>
            <Input
              id="apiSecret"
              type="password"
              value={formData.apiSecret}
              onChange={(e) => update('apiSecret', e.target.value)}
              required
              placeholder="Your Fyndiq password / token"
              className={getFieldError('apiSecret') ? 'border-red-500' : ''}
            />
            {getFieldError('apiSecret') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('apiSecret')?.message}</p>
            )}
          </div>
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

      {lastTestResult && (
        <Card padding="sm" className="shadow-none px-0">
          <h4 className="text-base font-semibold mb-2">Connection Test</h4>
          {testSummary}
        </Card>
      )}

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
