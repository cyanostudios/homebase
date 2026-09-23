import { Edit, Send, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useMail } from '../hooks/useMail';
import type { MailProviderSettings } from '../types/mail';

export function MailProviderDetailHeaderMenus({
  provider,
  leading,
  onSendTest,
}: {
  provider: MailProviderSettings;
  /** Optional leading content on the Actions row (e.g. provider name). */
  leading?: React.ReactNode;
  /** Scroll/focus the stacked test card (no tab navigation). */
  onSendTest?: () => void;
}) {
  const { t } = useTranslation();
  const { openMailForEdit, deleteProvider, getDeleteMessage } = useMail();

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProvider(provider.providerKey);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const next: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openMailForEdit(provider),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDelete(true),
      },
    ];
    if (provider.emailCapable && onSendTest) {
      next.push({
        id: 'send-test',
        icon: Send,
        label: t('mail.sendTest', { defaultValue: 'Send test email' }),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        disabled: !provider.configured,
        onClick: onSendTest,
      });
    }
    return next;
  }, [onSendTest, openMailForEdit, provider, t]);

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')} leading={leading}>
      <ConfirmDialog
        isOpen={showDelete}
        title={t('mail.deleteTitle', { defaultValue: 'Delete provider' })}
        message={getDeleteMessage(provider)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
        variant="danger"
        confirmDisabled={deleting}
      />
    </DetailHeaderMenus>
  );
}
