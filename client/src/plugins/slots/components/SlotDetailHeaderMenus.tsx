import { Copy, Download, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';
import { cn } from '@/lib/utils';

import { useSlotsContext } from '../context/SlotsContext';
import type { Slot } from '../types/slots';

function getSlotActionIconColorClass(actionId: string): string {
  if (actionId === 'send-message') {
    return 'text-violet-600 dark:text-violet-400';
  }
  if (actionId === 'send-email') {
    return 'text-red-600 dark:text-red-400';
  }
  return '';
}

export function SlotDetailHeaderMenus({ slot }: { slot: Slot }) {
  const { t } = useTranslation();
  const {
    openSlotForEdit,
    deleteSlot,
    getDeleteMessage,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedSlotId,
    detailFooterActions,
    exportFormats,
    onExportItem,
  } = useSlotsContext();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getDuplicateConfig(slot);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openSlotForEdit(slot),
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

    if (Array.isArray(detailFooterActions)) {
      for (const action of detailFooterActions) {
        buttons.push({
          id: action.id,
          icon: action.icon,
          label: action.label,
          variant: 'secondary',
          disabled: action.disabled,
          contentClassName: cn(getSlotActionIconColorClass(action.id), action.className),
          onClick: () => action.onClick(slot),
        });
      }
    }

    return buttons;
  }, [canDuplicate, detailFooterActions, openSlotForEdit, slot, t]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    const exportLabelByFormat: Record<ExportFormat, string> = {
      txt: t('common.exportTxt'),
      csv: t('common.exportCsv'),
      pdf: t('common.exportPdf'),
    };
    return Array.isArray(exportFormats)
      ? exportFormats.map((format) => ({
          id: `export-${format}`,
          icon: Download,
          label: exportLabelByFormat[format],
          variant: 'secondary' as const,
          onClick: () => onExportItem(format, slot),
        }))
      : [];
  }, [exportFormats, onExportItem, slot, t]);

  return (
    <DetailHeaderMenus
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.slot') })}
        message={getDeleteMessage(slot)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteSlot(slot.id);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(slot, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedSlotId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? 'Name'}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
