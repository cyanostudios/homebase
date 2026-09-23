import { Edit, Send, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';

export function AIProviderDetailHeaderMenus({
  provider,
  leading,
  onTestConnection: onFocusTestCard,
}: {
  provider: ProviderSettings;
  /** Optional leading content on the Actions row (e.g. provider name). */
  leading?: React.ReactNode;
  /** Scroll to the stacked test card after starting a connection test. */
  onTestConnection?: () => void;
}) {
  const { t } = useTranslation();
  const {
    openAIProviderForEdit,
    deleteProvider,
    getDeleteMessage,
    handleTestConnection,
    testingProviderKey,
  } = useAIProviders();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const testing = testingProviderKey === provider.providerKey;

  const onTestConnection = useCallback(() => {
    onFocusTestCard?.();
    void handleTestConnection(provider);
  }, [handleTestConnection, onFocusTestCard, provider]);

  const actions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openAIProviderForEdit(provider),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
      },
      {
        id: 'test-connection',
        icon: Send,
        label: testing ? t('aiProviders.testing') : t('aiProviders.testConnection'),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        disabled: testing || !provider.hasApiKey,
        onClick: onTestConnection,
      },
    ],
    [onTestConnection, openAIProviderForEdit, provider, testing, t],
  );

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')} leading={leading}>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('aiProviders.deleteTitle')}
        message={getDeleteMessage(provider)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() =>
          void deleteProvider(provider.providerKey).then(() => setShowDeleteConfirm(false))
        }
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </DetailHeaderMenus>
  );
}
