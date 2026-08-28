import { Clock, Copy, Download, Edit, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { apiFetch } from '@/core/api/apiFetch';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import type { ExportFormat } from '@/core/utils/exportUtils';

import { useContacts } from '../hooks/useContacts';
import type { Contact } from '../types/contacts';

type TimeEntry = { id: string; seconds: number; loggedAt: string };

export function ContactDetailHeaderMenus({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const {
    openContactForEdit,
    deleteContact,
    getDeleteMessage,
    closeContactPanel,
    detailFooterActions,
    exportFormats,
    onExportItem,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedContactId,
    setContactHasTimeEntries,
  } = useContacts();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);

  const duplicateConfig = getDuplicateConfig(contact);
  const canDuplicate = Boolean(duplicateConfig);

  useEffect(() => {
    if (!contact?.id) {
      setTimeEntries([]);
      return;
    }
    const contactId = contact.id;
    let cancelled = false;
    const loadTimeEntries = async () => {
      try {
        const response = await apiFetch(`/api/contacts/${contactId}/time-entries`);
        if (!response.ok) {
          if (!cancelled) {
            setTimeEntries([]);
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setTimeEntries(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setTimeEntries([]);
        }
      }
    };
    void loadTimeEntries();
    return () => {
      cancelled = true;
    };
  }, [contact?.id]);

  useEffect(() => {
    if (!contact?.id) {
      return;
    }
    setContactHasTimeEntries(contact.id, timeEntries.length > 0);
  }, [contact?.id, timeEntries.length, setContactHasTimeEntries]);

  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  }, []);

  const handleDeleteTimeEntry = useCallback(
    async (entryId: string) => {
      if (!contact?.id) {
        return;
      }
      setDeletingEntryId(entryId);
      try {
        const response = await apiFetch(`/api/contacts/${contact.id}/time-entries/${entryId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setTimeEntries((prev) => prev.filter((entry) => entry.id !== entryId));
        }
      } finally {
        setDeletingEntryId(null);
      }
    },
    [contact?.id],
  );

  const getActionIconColorClass = (actionId: string): string => {
    if (actionId === 'send-message') {
      return 'text-sky-500 dark:text-sky-400';
    }
    if (actionId === 'send-email') {
      return 'text-red-800 dark:text-red-500';
    }
    return '';
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('contacts.edit'),
        variant: 'soft',
        onClick: () => openContactForEdit(contact),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('contacts.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
      },
    ];

    if (canDuplicate) {
      buttons.push({
        id: 'duplicate',
        icon: Copy,
        label: t('contacts.duplicate'),
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
          contentClassName: getActionIconColorClass(action.id),
          onClick: () => action.onClick(contact),
        });
      }
    }

    return buttons;
  }, [canDuplicate, contact, detailFooterActions, openContactForEdit, t]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    if (!Array.isArray(exportFormats) || exportFormats.length === 0) {
      return [];
    }
    const exportLabelByFormat: Record<ExportFormat, string> = {
      txt: t('contacts.exportTxt'),
      csv: t('contacts.exportCsv'),
      pdf: t('contacts.exportPdf'),
    };
    return exportFormats.map((format) => ({
      id: `export-${format}`,
      icon: Download,
      label: exportLabelByFormat[format],
      variant: 'secondary' as const,
      onClick: () => onExportItem(format, contact),
    }));
  }, [contact, exportFormats, onExportItem, t]);

  const timeLogContent =
    timeEntries.length > 0 ? (
      <>
        {timeEntries.map((entry) => (
          <div
            key={entry.id}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-600 px-3.5 pr-2 text-sm text-white dark:bg-amber-600"
          >
            <Clock className="size-5 shrink-0 text-white" aria-hidden />
            <span className="whitespace-nowrap font-extrabold text-white">
              {formatDuration(entry.seconds)} – {new Date(entry.loggedAt).toLocaleDateString()}
            </span>
            <button
              type="button"
              className="ml-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 disabled:opacity-50"
              aria-label={t('contacts.delete')}
              title={t('contacts.delete')}
              disabled={deletingEntryId === entry.id}
              onClick={() => setConfirmDeleteEntryId(entry.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </>
    ) : null;

  return (
    <DetailHeaderMenus
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('contacts.headerActions')}
      exportLabel={t('contacts.headerExport')}
      extraMenus={
        timeEntries.length > 0
          ? [
              {
                id: 'timeLog',
                label: t('contacts.headerTimeLog'),
                icon: Clock,
                badgeCount: timeEntries.length,
                badgeAriaLabel: t('contacts.timeLoggedBadge'),
                content: timeLogContent,
              },
            ]
          : []
      }
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.contacts') })}
        message={getDeleteMessage(contact)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteContact(String(contact.id));
          setShowDeleteConfirm(false);
          closeContactPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={confirmDeleteEntryId !== null}
        title={t('contacts.deleteTimeEntryTitle')}
        message={t('contacts.deleteTimeEntryMessage')}
        confirmText={t('contacts.delete')}
        cancelText={t('contacts.cancel')}
        onConfirm={async () => {
          if (confirmDeleteEntryId) {
            await handleDeleteTimeEntry(confirmDeleteEntryId);
          }
          setConfirmDeleteEntryId(null);
        }}
        onCancel={() => setConfirmDeleteEntryId(null)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          void executeDuplicate(contact, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedContactId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('contacts.title')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
