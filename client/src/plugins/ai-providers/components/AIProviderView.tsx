import { Send, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_FIELD_LABEL_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';

interface AIProviderViewProps {
  aiProvider?: ProviderSettings | null;
  item?: ProviderSettings | null;
}

export const AIProviderView: React.FC<AIProviderViewProps> = ({
  aiProvider: aiProviderProp,
  item,
}) => {
  const { currentAIProvider, testResultMessage, testResultError } = useAIProviders();
  const provider = aiProviderProp ?? item ?? currentAIProvider ?? null;
  const { t } = useTranslation();

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

  return (
    <DetailLayout>
      <div className="space-y-4">
        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
          <DetailSection
            title={title}
            icon={Sparkles}
            iconPlugin="ai-providers"
            subtleTitle
            className="p-6"
          >
            <p className="text-sm text-muted-foreground">{provider.providerKey}</p>
          </DetailSection>
        </Card>

        <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
          <DetailSection
            title={t('aiProviders.sectionDetails', { defaultValue: 'Configuration' })}
            icon={Sparkles}
            iconPlugin="ai-providers"
            subtleTitle
            className="p-6"
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

        {(testResultMessage || testResultError) && (
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
            <DetailSection
              title={t('aiProviders.testTitle')}
              icon={Send}
              iconPlugin="ai-providers"
              subtleTitle
              className="p-4 sm:p-6"
            >
              {testResultError ? (
                <p className="text-sm text-destructive">{testResultError}</p>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400">{testResultMessage}</p>
              )}
            </DetailSection>
          </Card>
        )}
      </div>
    </DetailLayout>
  );
};
