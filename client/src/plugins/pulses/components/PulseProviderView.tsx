import { Bell, CheckCircle2, Circle, Info, KeyRound, Send, SlidersHorizontal } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';

import { PulseProviderDetailHeaderMenus } from './PulseProviderDetailHeaderMenus';

const PULSE_ENABLED_TITLE_ICON_CLASS =
  'h-8 w-8 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 [&_svg]:h-4 [&_svg]:w-4';
const PULSE_DISABLED_TITLE_ICON_CLASS =
  'h-8 w-8 bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 [&_svg]:h-4 [&_svg]:w-4';

interface PulseProviderViewProps {
  pulse?: PulseProviderSettings | null;
  item?: PulseProviderSettings | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const PulseProviderView: React.FC<PulseProviderViewProps> = ({
  pulse: pulseProp,
  item,
  stacked: _stacked = false,
}) => {
  const { currentPulse, testProvider } = usePulses();
  const provider = pulseProp ?? item ?? currentPulse ?? null;
  const { t } = useTranslation();

  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testToInputRef = useRef<HTMLInputElement>(null);
  const testCardRef = useRef<HTMLDivElement>(null);

  const focusTestCard = useCallback(() => {
    testCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => testToInputRef.current?.focus(), 200);
  }, []);

  const handleTest = async () => {
    if (!provider) {
      return;
    }
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

  if (!provider) {
    return null;
  }

  const title = t(`pulses.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(`pulses.providers.${provider.providerKey}.settingsDescription`, {
    defaultValue: '',
  });

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span
        title={
          provider.enabled
            ? t('pulses.statusEnabled', { defaultValue: 'Enabled' })
            : t('pulses.statusDisabled', { defaultValue: 'Disabled' })
        }
        className="inline-flex shrink-0"
      >
        <SectionCategoryIcon
          icon={Bell}
          className={
            provider.enabled ? PULSE_ENABLED_TITLE_ICON_CLASS : PULSE_DISABLED_TITLE_ICON_CLASS
          }
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <PulseProviderDetailHeaderMenus
            provider={provider}
            leading={titleLeading}
            onSendTest={provider.smsNotificationCapable ? focusTestCard : undefined}
          />
          <DetailHeaderMetaRow>
            <StatusOutlineBadge
              icon={provider.enabled ? CheckCircle2 : Circle}
              className={
                provider.enabled ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.neutral
              }
            >
              {provider.enabled
                ? t('pulses.statusEnabled', { defaultValue: 'Enabled' })
                : t('pulses.statusDisabled', { defaultValue: 'Disabled' })}
            </StatusOutlineBadge>
            <StatusOutlineBadge
              icon={KeyRound}
              className={
                provider.configured ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted
              }
            >
              {provider.configured
                ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                : t('pulses.keyMissing', { defaultValue: 'Missing' })}
            </StatusOutlineBadge>
          </DetailHeaderMetaRow>
        </div>
      </Card>

      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
        <DetailSection
          title={t('pulses.tabs.information', { defaultValue: 'Information' })}
          icon={Info}
          iconPlugin="pulses"
          subtleTitle
          className="p-4 sm:p-6"
        >
          <p className="text-sm font-extrabold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{provider.providerKey}</p>
        </DetailSection>
      </Card>

      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}>
        <DetailSection
          title={t('pulses.tabs.configuration', { defaultValue: 'Configuration' })}
          icon={SlidersHorizontal}
          iconPlugin="pulses"
          subtleTitle
          className="p-4 sm:p-6"
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
        <Card
          ref={testCardRef}
          padding="none"
          className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-pulses')}
        >
          <DetailSection
            title={t('pulses.tabs.test', { defaultValue: 'Test' })}
            icon={Send}
            iconPlugin="pulses"
            subtleTitle
            className="p-4 sm:p-6"
          >
            <p className="mb-3 text-sm text-muted-foreground">{t('pulses.testHint')}</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="pulse-test-to">{t('pulses.sendTestTo')}</Label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    ref={testToInputRef}
                    id="pulse-test-to"
                    className={cn(FORM_INPUT_CLASS, 'min-w-0 flex-1')}
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (!testing && provider.configured) {
                          void handleTest();
                        }
                      }
                    }}
                    placeholder="+4670…"
                    disabled={testing || !provider.configured}
                  />
                  <RoundIconLabelButton
                    type="button"
                    icon={Send}
                    label={testing ? t('pulses.sending') : t('pulses.sendTest')}
                    variant="primary"
                    size="xs"
                    alwaysExpanded
                    disabled={testing || !provider.configured || !testTo.trim()}
                    onClick={() => void handleTest()}
                  />
                </div>
              </div>
              {testError ? (
                <p className="text-sm text-destructive">{testError}</p>
              ) : testMessage ? (
                <p className="text-sm text-green-600 dark:text-green-400">{testMessage}</p>
              ) : (
                <p className={DETAIL_EMPTY_STATE_CLASS}>
                  {t('pulses.tabs.testEmpty', {
                    defaultValue: 'Enter a number to send a test SMS.',
                  })}
                </p>
              )}
            </div>
          </DetailSection>
        </Card>
      ) : null}
    </DetailLayout>
  );
};
