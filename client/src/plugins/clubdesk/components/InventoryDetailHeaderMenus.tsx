import { Archive, ArchiveRestore, Copy, Edit, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
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
    archiveInventoryItem,
    restoreInventoryItem,
    closeClubdeskPanel,
    getInventoryDuplicateConfig,
    executeInventoryDuplicate,
    setRecentlyDuplicatedInventoryId,
    getInventoryDeleteMessage,
  } = useClubdesk();
  const [confirm, setConfirm] = useState<'archive' | 'restore' | 'delete' | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getInventoryDuplicateConfig(item);
  const canDuplicate = Boolean(duplicateConfig);
  const archived = Boolean(item.archivedAt);
  const articleName = item.articleName?.trim() || t('nav.clubdesk-inventory');

  const openConfirm = useCallback((next: 'archive' | 'restore' | 'delete') => {
    setConfirmError(null);
    setConfirm(next);
  }, []);

  const closeConfirm = () => {
    if (confirmBusy) {
      return;
    }
    setConfirm(null);
    setConfirmError(null);
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openInventoryForEdit(item),
      },
      archived
        ? {
            id: 'restore',
            icon: ArchiveRestore,
            label: t('clubdesk.inventory.restore'),
            variant: 'secondary',
            onClick: () => openConfirm('restore'),
          }
        : {
            id: 'archive',
            icon: Archive,
            label: t('clubdesk.inventory.archive'),
            variant: 'secondary',
            onClick: () => openConfirm('archive'),
          },
    ];

    if (archived) {
      buttons.push({
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => openConfirm('delete'),
      });
    }

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
  }, [archived, canDuplicate, item, openConfirm, openInventoryForEdit, t]);

  const runConfirm = (action: () => Promise<string | null>) => {
    void (async () => {
      setConfirmBusy(true);
      setConfirmError(null);
      const errorMessage = await action();
      setConfirmBusy(false);
      if (!errorMessage) {
        setConfirm(null);
        if (confirm === 'delete') {
          closeClubdeskPanel();
        }
        return;
      }
      setConfirmError(errorMessage);
    })();
  };

  const confirmTitle =
    confirm === 'archive'
      ? t('clubdesk.inventory.archiveTitle', { name: articleName })
      : confirm === 'restore'
        ? t('clubdesk.inventory.restoreTitle', { name: articleName })
        : t('dialog.deleteItem', { label: t('nav.clubdesk-inventory') });
  const confirmMessage =
    confirmError ||
    (confirm === 'archive'
      ? t('clubdesk.inventory.archiveMessage')
      : confirm === 'restore'
        ? t('clubdesk.inventory.restoreMessage')
        : getInventoryDeleteMessage(item));
  const confirmText =
    confirm === 'archive'
      ? t('clubdesk.inventory.archive')
      : confirm === 'restore'
        ? t('clubdesk.inventory.restore')
        : t('common.delete');

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')} leading={leading}>
      <ConfirmDialog
        isOpen={confirm != null}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText={t('common.cancel')}
        confirmDisabled={confirmBusy}
        onConfirm={() => {
          if (confirm === 'archive') {
            runConfirm(() => archiveInventoryItem(item.id));
            return;
          }
          if (confirm === 'restore') {
            runConfirm(() => restoreInventoryItem(item.id));
            return;
          }
          runConfirm(() => deleteInventoryItem(item.id));
        }}
        onCancel={closeConfirm}
        variant={confirm === 'delete' ? 'danger' : 'warning'}
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
