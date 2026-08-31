import { Copy, Edit, Share2, Trash2, Upload } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList, InventoryItem } from '../types/garments';

import { GarmentPersonImportDialog } from './GarmentPersonImportDialog';

export function InventoryDetailHeaderMenus({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const {
    openInventoryForEdit,
    deleteInventoryItem,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedInventoryId,
    clearValidationErrors,
  } = useGarments();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const duplicateConfig = getDuplicateConfig(item);
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
        onClick: () => {
          setDeleteError(null);
          clearValidationErrors();
          setShowDeleteConfirm(true);
        },
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
  }, [canDuplicate, clearValidationErrors, item, openInventoryForEdit, t]);

  const confirmMessage = deleteError || getDeleteMessage(item);

  return (
    <DetailHeaderMenus
      actions={actions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('garments.inventoryItem') })}
        message={confirmMessage}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void (async () => {
            setDeleteError(null);
            const errorMessage = await deleteInventoryItem(item.id);
            if (!errorMessage) {
              setShowDeleteConfirm(false);
              return;
            }
            setDeleteError(errorMessage);
          })();
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteError(null);
        }}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(item, newName)
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
        nameLabel={duplicateConfig?.nameLabel ?? t('garments.articleName')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}

export function GarmentListDetailHeaderMenus({ list }: { list: GarmentList }) {
  const { t } = useTranslation();
  const {
    openGarmentForEdit,
    deleteGarment,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedListId,
    handleGarmentShareClick,
    garmentShareIsCreatingShare,
    importPersons,
  } = useGarments();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const duplicateConfig = getDuplicateConfig(list);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openGarmentForEdit(list),
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

    buttons.push({
      id: 'import-persons',
      icon: Upload,
      label: t('garments.importPersons'),
      variant: 'secondary',
      contentClassName: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => setIsImportDialogOpen(true),
    });

    buttons.push({
      id: 'share',
      icon: Share2,
      label: garmentShareIsCreatingShare ? t('garments.creatingShare') : t('garments.shareList'),
      variant: 'secondary',
      disabled: garmentShareIsCreatingShare,
      contentClassName: 'text-violet-600 dark:text-violet-400',
      onClick: () => void handleGarmentShareClick(list),
    });

    return buttons;
  }, [
    canDuplicate,
    garmentShareIsCreatingShare,
    handleGarmentShareClick,
    list,
    openGarmentForEdit,
    t,
  ]);

  return (
    <DetailHeaderMenus
      actions={actions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('garments.list') })}
        message={getDeleteMessage(list)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteGarment(list.id);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(list, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedListId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('garments.name')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />

      <GarmentPersonImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        listId={list.id}
        onImportRows={importPersons}
      />
    </DetailHeaderMenus>
  );
}
