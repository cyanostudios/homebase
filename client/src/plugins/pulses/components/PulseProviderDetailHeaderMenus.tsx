import { Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { usePulses } from '../hooks/usePulses';
import type { PulseProviderSettings } from '../types/pulse';

export function PulseProviderDetailHeaderMenus({ provider }: { provider: PulseProviderSettings }) {
  const { t } = useTranslation();
  const { openPulseForEdit, deleteProvider, getDeleteMessage } = usePulses();

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

  const actions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openPulseForEdit(provider),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDelete(true),
      },
    ],
    [openPulseForEdit, provider, t],
  );

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
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
    </DetailHeaderMenus>
  );
}
