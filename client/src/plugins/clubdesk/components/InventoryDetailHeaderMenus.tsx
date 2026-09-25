import { Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useClubdesk } from '../hooks/useClubdesk';
import type { ClubdeskInventoryItem } from '../types/inventory';

export function InventoryDetailHeaderMenus({
  item,
  leading,
}: {
  item: ClubdeskInventoryItem;
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    openInventoryForEdit,
    deleteInventoryItem,
    closeClubdeskPanel,
    getInventoryDeleteMessage,
  } = useClubdesk();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    return [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openInventoryForEdit(item),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
      },
    ];
  }, [item, openInventoryForEdit, t]);

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')} leading={leading}>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.clubdesk-inventory') })}
        message={getInventoryDeleteMessage(item)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteInventoryItem(item.id);
          closeClubdeskPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </DetailHeaderMenus>
  );
}
