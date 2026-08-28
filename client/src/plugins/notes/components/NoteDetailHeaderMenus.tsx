import { Copy, Download, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';

import { useNotes } from '../hooks/useNotes';
import type { Note } from '../types/notes';

function getNoteActionIconColorClass(actionId: string): string {
  if (actionId === 'send-message') {
    return 'text-violet-600 dark:text-violet-400';
  }
  if (actionId === 'send-email') {
    return 'text-red-600 dark:text-red-400';
  }
  if (actionId === 'create-task-from-note') {
    return 'text-green-600 dark:text-green-400';
  }
  return '';
}

function getNoteShareIconColorClass(actionId: string): string {
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

export function NoteDetailHeaderMenus({ note }: { note: Note }) {
  const { t } = useTranslation();
  const {
    openNoteForEdit,
    deleteNote,
    getDeleteMessage,
    closeNotePanel,
    detailFooterActions,
    exportFormats,
    onExportItem,
    exportShareActions,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedNoteId,
  } = useNotes();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getDuplicateConfig(note);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openNoteForEdit(note),
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
          contentClassName: getNoteActionIconColorClass(action.id),
          onClick: () => action.onClick(note),
        });
      }
    }

    return buttons;
  }, [canDuplicate, detailFooterActions, note, openNoteForEdit, t]);

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
          onClick: () => onExportItem(format, note),
        }))
      : [];

    const shareActions: DetailHeaderMenuAction[] = Array.isArray(exportShareActions)
      ? exportShareActions.map((action) => ({
          id: action.id,
          icon: action.icon,
          label: action.label,
          variant: 'secondary' as const,
          disabled: action.disabled,
          contentClassName: getNoteShareIconColorClass(action.id),
          onClick: () => action.onClick(note),
        }))
      : [];

    return [...formatActions, ...shareActions];
  }, [exportFormats, exportShareActions, note, onExportItem, t]);

  return (
    <DetailHeaderMenus
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.note') })}
        message={getDeleteMessage(note)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteNote(note.id);
          setShowDeleteConfirm(false);
          closeNotePanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(note, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedNoteId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('notes.title')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
