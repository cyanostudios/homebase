import { Copy, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';

function getEstimateActionIconColorClass(actionId: string): string {
  if (actionId === 'download-pdf') {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

export function EstimateDetailHeaderMenus({ estimate }: { estimate: Estimate }) {
  const { t } = useTranslation();
  const {
    openEstimateForEdit,
    deleteEstimate,
    closeEstimatePanel,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedEstimateId,
    getDeleteMessage,
    detailFooterActions,
  } = useEstimates();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getDuplicateConfig(estimate);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openEstimateForEdit(estimate),
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
  }, [canDuplicate, estimate, openEstimateForEdit, t]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    if (!Array.isArray(detailFooterActions)) {
      return [];
    }
    return detailFooterActions.map((action) => ({
      id: action.id,
      icon: action.icon,
      label: action.label,
      variant: 'secondary' as const,
      disabled: action.disabled,
      contentClassName: cn(getEstimateActionIconColorClass(action.id), action.className),
      onClick: () => action.onClick(estimate),
    }));
  }, [detailFooterActions, estimate]);

  return (
    <DetailHeaderMenus
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('estimates.deleteTitle')}
        message={getDeleteMessage(estimate)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteEstimate(estimate.id);
          closeEstimatePanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(estimate, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedEstimateId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('nav.estimate')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
