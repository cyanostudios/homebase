import {
  Archive,
  ArchiveRestore,
  Copy,
  Columns3,
  Edit,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundExpandableQuickAdd } from '@/components/ui/round-expandable-quick-add';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';

import { useGarments } from '../hooks/useGarments';
import type { GarmentList, InventoryItem } from '../types/garments';

import { GarmentPersonImportDialog } from './GarmentPersonImportDialog';

export function InventoryDetailHeaderMenus({
  item,
  leading,
}: {
  item: InventoryItem;
  /** Optional leading content on the Actions row (e.g. article name). */
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const {
    openInventoryForEdit,
    deleteInventoryItem,
    archiveInventoryItem,
    restoreInventoryItem,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedInventoryId,
    clearValidationErrors,
  } = useGarments();

  const [confirm, setConfirm] = useState<'archive' | 'restore' | 'delete' | 'deleteBlocked' | null>(
    null,
  );
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const duplicateConfig = getDuplicateConfig(item);
  const canDuplicate = Boolean(duplicateConfig);
  const archived = Boolean(item.archivedAt);
  const onLists = (item.assignedListIds?.length ?? 0) > 0;
  const articleName = item.articleName?.trim() || t('garments.inventoryItem');

  const openConfirm = useCallback(
    (next: 'archive' | 'restore' | 'delete' | 'deleteBlocked') => {
      setConfirmError(null);
      clearValidationErrors();
      setConfirm(next);
    },
    [clearValidationErrors],
  );

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
            label: t('garments.restore'),
            variant: 'secondary',
            onClick: () => openConfirm('restore'),
          }
        : {
            id: 'archive',
            icon: Archive,
            label: t('garments.archive'),
            variant: 'secondary',
            onClick: () => openConfirm('archive'),
          },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => openConfirm(onLists ? 'deleteBlocked' : 'delete'),
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
  }, [archived, canDuplicate, item, onLists, openConfirm, openInventoryForEdit, t]);

  const runConfirm = (action: () => Promise<string | null>) => {
    void (async () => {
      setConfirmBusy(true);
      setConfirmError(null);
      const errorMessage = await action();
      setConfirmBusy(false);
      if (!errorMessage) {
        setConfirm(null);
        return;
      }
      setConfirmError(errorMessage);
    })();
  };

  const blockedAndArchived = confirm === 'deleteBlocked' && archived;
  const confirmTitle =
    confirm === 'archive'
      ? t('garments.archiveTitle', { name: articleName })
      : confirm === 'restore'
        ? t('garments.restoreTitle', { name: articleName })
        : confirm === 'deleteBlocked'
          ? t('garments.deleteInventoryBlockedTitle')
          : t('dialog.deleteItem', { label: t('garments.inventoryItem') });
  const confirmMessage =
    confirmError ||
    (confirm === 'archive'
      ? t('garments.archiveMessage')
      : confirm === 'restore'
        ? t('garments.restoreMessage')
        : confirm === 'deleteBlocked'
          ? t(
              archived
                ? 'garments.deleteInventoryBlockedArchived'
                : 'garments.deleteInventoryBlockedActive',
            )
          : getDeleteMessage(item));
  const confirmText = blockedAndArchived
    ? t('common.close')
    : confirm === 'archive' || (confirm === 'deleteBlocked' && !archived)
      ? t('garments.archive')
      : confirm === 'restore'
        ? t('garments.restore')
        : t('common.delete');

  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={confirm != null}
        title={confirmTitle}
        message={confirmMessage}
        confirmText={confirmText}
        cancelText={blockedAndArchived ? undefined : t('common.cancel')}
        confirmDisabled={confirmBusy}
        onConfirm={() => {
          if (blockedAndArchived) {
            closeConfirm();
            return;
          }
          if (confirm === 'archive' || confirm === 'deleteBlocked') {
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
        title={t('common.duplicate')}
        confirmText={t('common.copy')}
        onConfirm={(newName) =>
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
            })
        }
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('garments.articleName')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}

export function GarmentListDetailHeaderMenus({
  list,
  leading,
}: {
  list: GarmentList;
  /** Optional leading content on the Actions row (e.g. list name). */
  leading?: React.ReactNode;
}) {
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
    addPerson,
    openGarmentsSettings,
  } = useGarments();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const duplicateConfig = getDuplicateConfig(list);
  const canDuplicate = Boolean(duplicateConfig);

  const handleQuickAddPerson = useCallback(
    async (name: string) => {
      const created = await addPerson(list.id, { name });
      if (!created) {
        throw new Error('Failed to add person');
      }
    },
    [addPerson, list.id],
  );

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
      id: 'columns',
      icon: Columns3,
      label: t('garments.configurePersonColumns'),
      variant: 'secondary',
      contentClassName: 'text-sky-700 dark:text-sky-300',
      onClick: () => openGarmentsSettings('lists', list.id),
    });

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
    openGarmentsSettings,
    t,
  ]);

  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
      afterActions={
        <RoundExpandableQuickAdd
          label={t('garments.quickAdd')}
          placeholder={t('garments.quickAddPlaceholder')}
          onCreate={handleQuickAddPerson}
          alwaysExpanded
        />
      }
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
        title={t('common.duplicate')}
        confirmText={t('common.copy')}
        onConfirm={(newName) =>
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
            })
        }
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
