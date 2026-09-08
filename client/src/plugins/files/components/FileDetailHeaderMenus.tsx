import { Download, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { filesApi } from '../api/filesApi';
import { useFiles } from '../hooks/useFiles';
import type { FileItem } from '../types/files';

export function FileDetailHeaderMenus({ file }: { file: FileItem }) {
  const { t } = useTranslation();
  const { openFileForEdit, deleteFile, getDeleteMessage, closeFilePanel } = useFiles();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    return [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        contentClassName: 'text-blue-600 dark:text-blue-400',
        onClick: () => openFileForEdit(file),
      },
      {
        id: 'download',
        icon: Download,
        label: t('files.download'),
        variant: 'secondary',
        onClick: () => {
          window.open(filesApi.getFileDownloadUrl(file.id), '_blank', 'noopener,noreferrer');
        },
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
  }, [file, openFileForEdit, t]);

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('files.deleteTitle')}
        message={getDeleteMessage(file)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          void (async () => {
            await deleteFile(file.id);
            setShowDeleteConfirm(false);
            closeFilePanel();
          })();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </DetailHeaderMenus>
  );
}
