/**
 * Thin DetailHeaderMenus wrapper — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/ingest/components/IngestSourceDetailHeaderMenus.tsx.
 */
import { Edit, ExternalLink, Play, Square, Trash2, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useSiteAuditNow } from '../hooks/useSiteAuditNow';
import { useSiteAudits } from '../hooks/useSiteAudits';
import type { SiteAudit } from '../types/site-audits';
import { formatSiteAuditDuration, siteAuditRunDurationMs } from '../utils/siteAuditDuration';

export function SiteAuditDetailHeaderMenus({
  item,
  leading,
  isRunActive = false,
  isCancelling = false,
  runStartedAt = null,
  onRunAudit,
  onQuickAudit,
  onStopAudit,
}: {
  item: SiteAudit;
  /** Optional leading content on the Actions row (e.g. site name). */
  leading?: React.ReactNode;
  /** True while a run for this site is queued/running. */
  isRunActive?: boolean;
  isCancelling?: boolean;
  runStartedAt?: string | null;
  /** Overrides the default `startSiteAuditRun` call (e.g. so the view can also poll). */
  onRunAudit?: () => void;
  onQuickAudit?: () => void;
  onStopAudit?: () => void;
}) {
  const { t } = useTranslation();
  const {
    openSiteAuditForEdit,
    deleteSiteAudit,
    getDeleteMessage,
    closeSiteAuditPanel,
    startSiteAuditRun,
  } = useSiteAudits();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const now = useSiteAuditNow(isRunActive);
  const elapsedLabel = formatSiteAuditDuration(
    siteAuditRunDurationMs(runStartedAt, isRunActive ? null : undefined, now),
  );

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSiteAudit(item.id);
      setShowDeleteConfirm(false);
      closeSiteAuditPanel();
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : '';
      setDeleteError(
        message && message !== 'Request failed' ? message : t('siteAudits.errors.deleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const runOrStop: DetailHeaderMenuAction =
      isRunActive && onStopAudit
        ? {
            id: 'stop-audit',
            icon: Square,
            label: isCancelling
              ? t('siteAudits.stopping')
              : t('siteAudits.stopAuditWithTime', { time: elapsedLabel }),
            variant: 'secondary',
            contentClassName: 'text-amber-700 dark:text-amber-400',
            disabled: isCancelling,
            onClick: () => onStopAudit(),
          }
        : {
            id: 'run-audit',
            icon: Play,
            label: isRunActive
              ? t('siteAudits.runningWithTime', { time: elapsedLabel })
              : t('siteAudits.runAudit'),
            variant: 'secondary',
            contentClassName: 'text-green-600 dark:text-green-400',
            disabled: isRunActive,
            onClick: () => {
              if (onRunAudit) {
                onRunAudit();
                return;
              }
              void startSiteAuditRun(item.id).catch((err) => {
                console.error('Failed to start site audit run:', err);
              });
            },
          };

    const quickAuditAction: DetailHeaderMenuAction | null =
      isRunActive || !onQuickAudit
        ? null
        : {
            id: 'quick-audit',
            icon: Zap,
            label: t('siteAudits.quickAudit'),
            variant: 'secondary',
            disabled: isRunActive,
            onClick: () => onQuickAudit(),
          };

    return [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openSiteAuditForEdit(item),
      },
      runOrStop,
      ...(quickAuditAction ? [quickAuditAction] : []),
      {
        id: 'open-url',
        icon: ExternalLink,
        label: t('siteAudits.openUrl'),
        variant: 'secondary',
        onClick: () => window.open(item.url, '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => {
          setDeleteError(null);
          setShowDeleteConfirm(true);
        },
      },
    ];
  }, [
    elapsedLabel,
    isCancelling,
    isRunActive,
    item,
    onQuickAudit,
    onRunAudit,
    onStopAudit,
    openSiteAuditForEdit,
    startSiteAuditRun,
    t,
  ]);

  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      actionsLabel={t('common.actions', { defaultValue: 'Actions' })}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.site-audits') })}
        message={deleteError ?? getDeleteMessage(item)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          setDeleteError(null);
          setShowDeleteConfirm(false);
        }}
        variant="danger"
        confirmDisabled={deleting}
      />
    </DetailHeaderMenus>
  );
}
