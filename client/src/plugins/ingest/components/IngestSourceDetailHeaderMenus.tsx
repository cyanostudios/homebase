import { Edit, ExternalLink, Play, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useIngest } from '../hooks/useIngest';
import type { IngestSource } from '../types/ingest';

export function IngestSourceDetailHeaderMenus({ source }: { source: IngestSource }) {
  const { t } = useTranslation();
  const {
    openIngestSourceForEdit,
    deleteIngestSource,
    getDeleteMessage,
    importRunning,
    runIngestSource,
  } = useIngest();

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteIngestSource(source.id);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const actions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openIngestSourceForEdit(source),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDelete(true),
      },
      {
        id: 'run-import',
        icon: Play,
        label: importRunning ? t('ingest.running') : t('ingest.runImport'),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        disabled: importRunning || !source.isActive,
        onClick: () => void runIngestSource(source.id),
      },
      {
        id: 'open-url',
        icon: ExternalLink,
        label: t('ingest.openUrl'),
        variant: 'secondary',
        onClick: () => window.open(source.sourceUrl, '_blank', 'noopener,noreferrer'),
      },
    ],
    [importRunning, openIngestSourceForEdit, runIngestSource, source, t],
  );

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
      <ConfirmDialog
        isOpen={showDelete}
        title={t('ingest.deleteTitle')}
        message={getDeleteMessage(source)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setShowDelete(false)}
        variant="danger"
        confirmDisabled={deleting}
      />
    </DetailHeaderMenus>
  );
}
