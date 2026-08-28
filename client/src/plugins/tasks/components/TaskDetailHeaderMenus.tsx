import { Copy, Download, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';

import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types/tasks';

function getShareIconColorClass(actionId: string): string {
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

export function TaskDetailHeaderMenus({ task }: { task: Task }) {
  const { t } = useTranslation();
  const {
    openTaskForEdit,
    deleteTask,
    getDeleteMessage,
    closeTaskPanel,
    exportFormats,
    onExportItem,
    exportShareActions,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedTaskId,
  } = useTasks();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getDuplicateConfig(task);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openTaskForEdit(task),
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
  }, [canDuplicate, openTaskForEdit, t, task]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    const exportLabelByFormat: Record<ExportFormat, string> = {
      txt: t('common.exportTxt'),
      csv: t('common.exportCsv'),
      pdf: t('common.exportPdf'),
    };
    const formatActions: DetailHeaderMenuAction[] = Array.isArray(exportFormats)
      ? exportFormats.map((format) => ({
          id: `export-${format}`,
          icon: Download,
          label: exportLabelByFormat[format],
          variant: 'secondary' as const,
          onClick: () => onExportItem(format, task),
        }))
      : [];

    const shareActions: DetailHeaderMenuAction[] = Array.isArray(exportShareActions)
      ? exportShareActions.map((action) => ({
          id: action.id,
          icon: action.icon,
          label: action.label,
          variant: 'secondary' as const,
          disabled: action.disabled,
          contentClassName: getShareIconColorClass(action.id),
          onClick: () => action.onClick(task),
        }))
      : [];

    return [...formatActions, ...shareActions];
  }, [exportFormats, exportShareActions, onExportItem, task]);

  return (
    <DetailHeaderMenus
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.task') })}
        message={getDeleteMessage(task)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteTask(task.id);
          setShowDeleteConfirm(false);
          closeTaskPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(task, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedTaskId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('tasks.title')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
