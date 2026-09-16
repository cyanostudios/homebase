import { Info, Send, SlidersHorizontal, Sparkles } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';

import { AIProviderDetailHeaderMenus } from './AIProviderDetailHeaderMenus';

type AIProviderViewTab = 'information' | 'configuration' | 'test';

const AI_PROVIDER_VIEW_TABS: AIProviderViewTab[] = ['information', 'configuration', 'test'];

function parseAIProviderViewTab(value: string | null): AIProviderViewTab {
  if (value && AI_PROVIDER_VIEW_TABS.includes(value as AIProviderViewTab)) {
    return value as AIProviderViewTab;
  }
  return 'information';
}

interface AIProviderViewProps {
  aiProvider?: ProviderSettings | null;
  item?: ProviderSettings | null;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

export const AIProviderView: React.FC<AIProviderViewProps> = ({
  aiProvider: aiProviderProp,
  item,
  stacked: _stacked = false,
}) => {
  const { currentAIProvider, testResultMessage, testResultError } = useAIProviders();
  const provider = aiProviderProp ?? item ?? currentAIProvider ?? null;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseAIProviderViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: AIProviderViewTab) => {
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

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('aiProviders.tabs.information'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'configuration' as const,
        label: t('aiProviders.tabs.configuration'),
        icon: SlidersHorizontal,
        count: null as number | null,
      },
      {
        id: 'test' as const,
        label: t('aiProviders.tabs.test'),
        icon: Send,
        count: null as number | null,
      },
    ],
    [t],
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

  if (!provider) {
    return null;
  }

  const title = t(`aiProviders.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
  const settingsDescription = t(
    `aiProviders.providers.${provider.providerKey}.settingsDescription`,
    {
      defaultValue: '',
    },
  );
  const docsUrl = t(`aiProviders.providers.${provider.providerKey}.docsUrl`, { defaultValue: '' });
  const docsLabel = t(`aiProviders.providers.${provider.providerKey}.docsLabel`, {
    defaultValue: '',
  });

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span
        title={t('nav.ai-providers', { defaultValue: 'AI Providers' })}
        className="inline-flex shrink-0"
      >
        <SectionCategoryIcon
          icon={Sparkles}
          className="h-8 w-8 bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  const informationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
      <DetailSection
        title={t('aiProviders.tabs.information')}
        icon={Info}
        iconPlugin="ai-providers"
        subtleTitle
        className="p-4 sm:p-6"
      >
        <p className="text-sm font-extrabold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{provider.providerKey}</p>
      </DetailSection>
    </Card>
  );

  const configurationCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
      <DetailSection
        title={t('aiProviders.tabs.configuration')}
        icon={SlidersHorizontal}
        iconPlugin="ai-providers"
        subtleTitle
        className="p-4 sm:p-6"
      >
        {settingsDescription ? (
          <p className="mb-4 text-sm text-muted-foreground">{settingsDescription}</p>
        ) : null}
        {(docsUrl || docsLabel) && (
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>{t('aiProviders.credentials')}</div>
            <p className="text-sm text-muted-foreground">
              {t('aiProviders.credentialsHint')}{' '}
              {docsUrl ? (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {docsLabel || docsUrl}
                </a>
              ) : (
                docsLabel
              )}
            </p>
          </div>
        )}
      </DetailSection>
    </Card>
  );

  const testCard = (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
      <DetailSection
        title={t('aiProviders.tabs.test')}
        icon={Send}
        iconPlugin="ai-providers"
        subtleTitle
        className="p-4 sm:p-6"
      >
        {testResultError ? (
          <p className="text-sm text-destructive">{testResultError}</p>
        ) : testResultMessage ? (
          <p className="text-sm text-green-600 dark:text-green-400">{testResultMessage}</p>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('aiProviders.tabs.testEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card
        padding="none"
        className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers flex flex-col')}
      >
        <div className="border-b border-border/50 px-4 py-5">
          <AIProviderDetailHeaderMenus provider={provider} leading={titleLeading} />
          <div className="mt-4">{tabChips}</div>
        </div>
      </Card>
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'configuration' ? configurationCard : null}
      {activeTab === 'test' ? testCard : null}
    </DetailLayout>
  );
};
