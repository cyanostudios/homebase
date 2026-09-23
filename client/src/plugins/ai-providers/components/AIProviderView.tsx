import {
  CheckCircle2,
  Circle,
  Info,
  KeyRound,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DetailHeaderMetaRow } from '@/core/ui/DetailHeaderMenus';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';

import { AIProviderDetailHeaderMenus } from './AIProviderDetailHeaderMenus';

const AI_ENABLED_TITLE_ICON_CLASS =
  'h-8 w-8 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 [&_svg]:h-4 [&_svg]:w-4';
const AI_DISABLED_TITLE_ICON_CLASS =
  'h-8 w-8 bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 [&_svg]:h-4 [&_svg]:w-4';

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
  const testCardRef = useRef<HTMLDivElement>(null);

  const focusTestCard = useCallback(() => {
    testCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
        title={
          provider.enabled
            ? t('aiProviders.statusEnabled', { defaultValue: 'Enabled' })
            : t('aiProviders.statusDisabled', { defaultValue: 'Disabled' })
        }
        className="inline-flex shrink-0"
      >
        <SectionCategoryIcon
          icon={Sparkles}
          className={provider.enabled ? AI_ENABLED_TITLE_ICON_CLASS : AI_DISABLED_TITLE_ICON_CLASS}
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <Card
        padding="none"
        className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers flex flex-col')}
      >
        <div className="border-b border-border/50 px-4 py-5">
          <AIProviderDetailHeaderMenus
            provider={provider}
            leading={titleLeading}
            onTestConnection={focusTestCard}
          />
          <DetailHeaderMetaRow>
            <StatusOutlineBadge
              icon={provider.enabled ? CheckCircle2 : Circle}
              className={
                provider.enabled ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.neutral
              }
            >
              {provider.enabled
                ? t('aiProviders.statusEnabled', { defaultValue: 'Enabled' })
                : t('aiProviders.statusDisabled', { defaultValue: 'Disabled' })}
            </StatusOutlineBadge>
            <StatusOutlineBadge
              icon={KeyRound}
              className={
                provider.hasApiKey ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.muted
              }
            >
              {provider.hasApiKey
                ? t('aiProviders.keyConfigured', { defaultValue: 'Configured' })
                : t('aiProviders.keyMissing', { defaultValue: 'Missing' })}
            </StatusOutlineBadge>
          </DetailHeaderMetaRow>
        </div>
      </Card>

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

      <Card
        ref={testCardRef}
        padding="none"
        className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}
      >
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
    </DetailLayout>
  );
};
