import { Edit, Info, Send, Sparkles, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
  const { currentAIProvider } = useAIProviders();
  const provider = aiProviderProp ?? item ?? currentAIProvider ?? null;
  const { t } = useTranslation();
  const { openAIProviderForEdit, deleteProvider, getDeleteMessage, testConnection } =
    useAIProviders();

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const result = await testConnection(provider.providerKey, { useSaved: true });
      setTestMessage(
        t('aiProviders.testSuccess', {
          defaultValue: 'Connection OK ({{model}})',
          model: result.model,
        }),
      );
    } catch (err: unknown) {
      setTestError(
        (err as Error)?.message ||
          t('aiProviders.testError', { defaultValue: 'Connection test failed' }),
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
              <DetailSection
                title={t('aiProviders.quickActions', { defaultValue: 'Quick actions' })}
                icon={Zap}
                iconPlugin="ai-providers"
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
                    onClick={() => openAIProviderForEdit(provider)}
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
                    disabled={testing || !provider.hasApiKey}
                    onClick={() => void handleTest()}
                  >
                    {testing ? t('aiProviders.testing') : t('aiProviders.testConnection')}
                  </Button>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
              <DetailSection
                title={t('aiProviders.information', { defaultValue: 'Information' })}
                icon={Info}
                iconPlugin="ai-providers"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('aiProviders.colProvider', { defaultValue: 'Provider' })}
                    </span>
                    <span className="font-extrabold text-foreground">{title}</span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('aiProviders.providerKey', { defaultValue: 'Key' })}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {provider.providerKey}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('aiProviders.enabled')}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {provider.enabled ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('aiProviders.defaultModel')}
                    </span>
                    <span className="truncate text-right font-extrabold text-foreground">
                      {provider.defaultModel || '—'}
                    </span>
                  </div>
                  {provider.providerKey === 'elevenlabs' ? (
                    <div className={DETAIL_INFO_ROW_CLASS}>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('aiProviders.voice', { defaultValue: 'Voice' })}
                      </span>
                      <span className="truncate text-right font-mono text-sm font-extrabold text-foreground">
                        {provider.voiceId || '—'}
                      </span>
                    </div>
                  ) : null}
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('aiProviders.apiKey')}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {provider.hasApiKey
                        ? t('aiProviders.keyConfigured')
                        : t('aiProviders.keyMissing')}
                    </span>
                  </div>
                  <div className={cn(DETAIL_INFO_ROW_CLASS, 'border-t border-border/50 pt-2')}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.created')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
                      {provider.createdAt ? new Date(provider.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t('common.updated')}
                    </span>
                    <span className="font-mono font-extrabold text-foreground">
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

          {(testMessage || testError) && (
            <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-ai-providers')}>
              <DetailSection
                title={t('aiProviders.testTitle')}
                icon={Send}
                iconPlugin="ai-providers"
                subtleTitle
                className="p-4 sm:p-6"
              >
                {testError ? (
                  <p className="text-sm text-destructive">{testError}</p>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-400">{testMessage}</p>
                )}
              </DetailSection>
            </Card>
          )}
        </div>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDelete}
        title={t('aiProviders.deleteTitle')}
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
