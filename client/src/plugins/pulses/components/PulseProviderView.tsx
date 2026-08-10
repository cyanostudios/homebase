import { Edit, Info, Send, Smartphone, Trash2, Zap } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';

interface PulseProviderViewProps {
  pulse?: PulseProviderSettings | null;
  item?: PulseProviderSettings | null;
}

export const PulseProviderView: React.FC<PulseProviderViewProps> = ({ pulse: pulseProp, item }) => {
  const { currentPulse } = usePulses();
  const provider = pulseProp ?? item ?? currentPulse ?? null;
  const { t } = useTranslation();
  const { openPulseForEdit, deleteProvider, getDeleteMessage, testProvider } = usePulses();

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testToInputRef = useRef<HTMLInputElement>(null);

  if (!provider) {
    return null;
  }

  const title = t(`pulses.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(`pulses.providers.${provider.providerKey}.settingsDescription`, {
    defaultValue: '',
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProvider(provider.providerKey);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const handleTest = async () => {
    if (!testTo.trim()) {
      setTestError(t('pulses.testNumberRequired'));
      testToInputRef.current?.focus();
      return;
    }
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const result = await testProvider(provider.providerKey, {
        testTo: testTo.trim(),
        useSaved: true,
      });
      setTestMessage(
        t('pulses.testSent', {
          defaultValue: 'Test SMS sent ({{status}})',
          status: result.status,
        }),
      );
    } catch (err: unknown) {
      setTestError((err as Error)?.message || t('pulses.testError'));
    } finally {
      setTesting(false);
    }
  };

  const focusTestForm = () => {
    testToInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    testToInputRef.current?.focus();
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
              <DetailSection
                title={t('pulses.quickActions', { defaultValue: 'Quick actions' })}
                icon={Zap}
                iconPlugin="pulses"
                subtleTitle
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Edit
                        {...props}
                        className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
                      />
                    )}
                    className={DETAIL_QUICK_ACTION_ROW_CLASS}
                    onClick={() => openPulseForEdit(provider)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={(props) => (
                      <Trash2
                        {...props}
                        className={cn(props.className, 'text-red-600 dark:text-red-400')}
                      />
                    )}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setShowDelete(true)}
                  >
                    {t('common.delete')}
                  </Button>
                  {provider.smsNotificationCapable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={(props) => (
                        <Send
                          {...props}
                          className={cn(props.className, 'text-green-600 dark:text-green-400')}
                        />
                      )}
                      className={DETAIL_QUICK_ACTION_ROW_CLASS}
                      disabled={!provider.configured}
                      onClick={focusTestForm}
                    >
                      {t('pulses.sendTest')}
                    </Button>
                  ) : null}
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
              <DetailSection
                title={t('pulses.information', { defaultValue: 'Information' })}
                icon={Info}
                iconPlugin="pulses"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pulses.colProvider', { defaultValue: 'Provider' })}
                    </span>
                    <span className="font-semibold text-foreground">{title}</span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pulses.providerKey', { defaultValue: 'Key' })}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {provider.providerKey}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pulses.enabled')}
                    </span>
                    <span className="font-semibold text-foreground">
                      {provider.enabled ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pulses.capability', { defaultValue: 'Capability' })}
                    </span>
                    <span className="font-semibold text-foreground">
                      {provider.smsNotificationCapable
                        ? t('pulses.smsCapable', { defaultValue: 'SMS' })
                        : t('pulses.verifyOnly', { defaultValue: 'Verify only' })}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('pulses.credentials')}
                    </span>
                    <span className="font-semibold text-foreground">
                      {provider.configured
                        ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                        : t('pulses.keyMissing', { defaultValue: 'Missing' })}
                    </span>
                  </div>
                  <div className={cn(DETAIL_INFO_ROW_CLASS, 'border-t border-border/50 pt-2')}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {provider.createdAt ? new Date(provider.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {provider.updatedAt ? new Date(provider.updatedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
          </div>
        }
      >
        <div className="space-y-4">
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
            <DetailSection
              title={title}
              icon={Smartphone}
              iconPlugin="pulses"
              subtleTitle
              className="p-6"
            >
              <p className="text-sm text-muted-foreground">{provider.providerKey}</p>
            </DetailSection>
          </Card>

          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
            <DetailSection
              title={t('pulses.sectionDetails', { defaultValue: 'Configuration' })}
              icon={Smartphone}
              iconPlugin="pulses"
              subtleTitle
              className="p-6"
            >
              {settingsDescription ? (
                <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
              ) : null}
              {!provider.smsNotificationCapable ? (
                <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    {t('pulses.notSmsRoutableHint', {
                      defaultValue:
                        'Credentials only — not available for SMS routing in v1 (verify/OTP deferred).',
                    })}
                  </p>
                </div>
              ) : (
                <div>
                  <div className={DETAIL_FIELD_LABEL_CLASS}>{t('pulses.credentials')}</div>
                  <p className="text-sm text-muted-foreground">
                    {provider.configured
                      ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                      : t('pulses.keyMissing', { defaultValue: 'Missing' })}
                    . {t('pulses.settingsDescription')}
                  </p>
                </div>
              )}
            </DetailSection>
          </Card>

          {provider.smsNotificationCapable ? (
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
              <DetailSection
                title={t('pulses.testTitle')}
                icon={Send}
                iconPlugin="pulses"
                subtleTitle
                className="p-4 sm:p-6"
              >
                <p className="mb-3 text-sm text-muted-foreground">{t('pulses.testHint')}</p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="pulse-test-to">{t('pulses.sendTestTo')}</Label>
                    <Input
                      ref={testToInputRef}
                      id="pulse-test-to"
                      className="mt-1"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="+4670…"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Send}
                    className="h-9 px-3 text-xs"
                    disabled={testing || !provider.configured}
                    onClick={() => void handleTest()}
                  >
                    {testing ? t('pulses.sending') : t('pulses.sendTest')}
                  </Button>
                  {testError ? (
                    <p className="text-sm text-destructive">{testError}</p>
                  ) : testMessage ? (
                    <p className="text-sm text-green-600 dark:text-green-400">{testMessage}</p>
                  ) : null}
                </div>
              </DetailSection>
            </Card>
          ) : null}
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDelete}
        title={t('pulses.deleteTitle', { defaultValue: 'Delete provider' })}
        message={getDeleteMessage(provider)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
        variant="danger"
        confirmDisabled={deleting}
      />
    </>
  );
};
