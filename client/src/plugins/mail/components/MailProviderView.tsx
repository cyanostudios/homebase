import { Info, Mail, Send, SlidersHorizontal } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { FORM_INPUT_CLASS } from '@/core/ui/formFieldStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useMail } from '../hooks/useMail';
import type { MailProviderSettings } from '../types/mail';

import { MailProviderDetailHeaderMenus } from './MailProviderDetailHeaderMenus';

type MailProviderViewTab = 'information' | 'configuration' | 'test';

const MAIL_PROVIDER_VIEW_TABS: MailProviderViewTab[] = ['information', 'configuration', 'test'];

function parseMailProviderViewTab(value: string | null): MailProviderViewTab {
  if (value && MAIL_PROVIDER_VIEW_TABS.includes(value as MailProviderViewTab)) {
    return value as MailProviderViewTab;
  }
  return 'information';
}

interface MailProviderViewProps {
  mail?: MailProviderSettings | null;
  item?: MailProviderSettings | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const MailProviderView: React.FC<MailProviderViewProps> = ({
  mail: mailProp,
  item,
  stacked: _stacked = false,
}) => {
  const { currentMail, testProvider } = useMail();
  const provider = mailProp ?? item ?? currentMail ?? null;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseMailProviderViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: MailProviderViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const testToInputRef = useRef<HTMLInputElement>(null);

  const tabs = useMemo(() => {
    const next: Array<{ id: MailProviderViewTab; label: string; icon: typeof Info }> = [
      {
        id: 'information',
        label: t('mail.tabs.information', { defaultValue: 'Information' }),
        icon: Info,
      },
      {
        id: 'configuration',
        label: t('mail.tabs.configuration', { defaultValue: 'Configuration' }),
        icon: SlidersHorizontal,
      },
    ];
    if (provider?.emailCapable) {
      next.push({
        id: 'test',
        label: t('mail.tabs.test', { defaultValue: 'Test' }),
        icon: Send,
      });
    }
    return next;
  }, [provider?.emailCapable, t]);

  const handleTest = async () => {
    if (!provider) {
      return;
    }
    if (!testTo.trim() || !testTo.includes('@')) {
      setTestError(t('mail.testEmailRequired', { defaultValue: 'Enter a valid email address' }));
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
        t('mail.testSent', {
          defaultValue: 'Test email sent ({{status}})',
          status: result.status,
        }),
      );
    } catch (err: unknown) {
      setTestError((err as Error)?.message || t('mail.testError', { defaultValue: 'Test failed' }));
    } finally {
      setTesting(false);
    }
  };

  if (!provider) {
    return null;
  }

  const title = t(`mail.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(`mail.providers.${provider.providerKey}.settingsDescription`, {
    defaultValue: '',
  });

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.mail', { defaultValue: 'Mail' })} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Mail}
          className="h-8 w-8 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const informationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
      <DetailSection
        title={t('mail.tabs.information', { defaultValue: 'Information' })}
        icon={Info}
        iconPlugin="mail"
        subtleTitle
        className="p-4 sm:p-6"
      >
        <p className="text-sm font-extrabold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{provider.providerKey}</p>
      </DetailSection>
    </Card>
  );

  const configurationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
      <DetailSection
        title={t('mail.tabs.configuration', { defaultValue: 'Configuration' })}
        icon={SlidersHorizontal}
        iconPlugin="mail"
        subtleTitle
        className="p-4 sm:p-6"
      >
        {settingsDescription ? (
          <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
        ) : null}
        <div>
          <div className={DETAIL_FIELD_LABEL_CLASS}>
            {t('mail.credentials', { defaultValue: 'Credentials' })}
          </div>
          <p className="text-sm text-muted-foreground">
            {provider.configured
              ? t('mail.keyConfigured', { defaultValue: 'Configured' })
              : t('mail.keyMissing', { defaultValue: 'Missing' })}
            .{' '}
            {t('mail.settingsDescription', {
              defaultValue: 'Configure credentials to send email from plugins.',
            })}
          </p>
        </div>
      </DetailSection>
    </Card>
  );

  const testCard = provider.emailCapable ? (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail')}>
      <DetailSection
        title={t('mail.tabs.test', { defaultValue: 'Test' })}
        icon={Send}
        iconPlugin="mail"
        subtleTitle
        className="p-4 sm:p-6"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {t('mail.testHint', {
            defaultValue: 'Send a test email using the saved credentials.',
          })}
        </p>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mail-test-to">
              {t('mail.sendTestTo', { defaultValue: 'Send test email to' })}
            </Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Input
                ref={testToInputRef}
                id="mail-test-to"
                type="email"
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
                placeholder="you@example.com"
                disabled={testing || !provider.configured}
              />
              <RoundIconLabelButton
                type="button"
                icon={Send}
                label={
                  testing
                    ? t('mail.sending', { defaultValue: 'Sending...' })
                    : t('mail.sendTest', { defaultValue: 'Send test email' })
                }
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
              {t('mail.tabs.testEmpty', {
                defaultValue: 'Enter an address to send a test email.',
              })}
            </p>
          )}
        </div>
      </DetailSection>
    </Card>
  ) : null;

  const resolvedTab = activeTab === 'test' && !provider.emailCapable ? 'information' : activeTab;

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-mail flex flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">
          <MailProviderDetailHeaderMenus provider={provider} leading={titleLeading} />
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {resolvedTab === 'information' ? informationCard : null}
      {resolvedTab === 'configuration' ? configurationCard : null}
      {resolvedTab === 'test' ? testCard : null}
    </DetailLayout>
  );
};
