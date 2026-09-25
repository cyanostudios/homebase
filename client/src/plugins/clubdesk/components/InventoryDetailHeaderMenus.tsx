import { Copy, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';

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
    getInventoryDuplicateConfig,
    executeInventoryDuplicate,
    setRecentlyDuplicatedInventoryId,
    getInventoryDeleteMessage,
  } = useClubdesk();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getInventoryDuplicateConfig(item);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
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

    if (canDuplicate) {
      buttons.push({
        id: 'duplicate',
        icon: Copy,
        label: t('common.duplicate'),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        onClick: () => setShowDuplicateDialog(true),
      });
    }

    return buttons;
  }, [canDuplicate, item, openInventoryForEdit, t]);

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

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeInventoryDuplicate(item, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedInventoryId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('clubdesk.inventory.articleName')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
