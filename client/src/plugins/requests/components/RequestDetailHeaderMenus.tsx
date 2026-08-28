import { Edit, ListPlus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { garmentsApi } from '@/plugins/garments/api/garmentsApi';

import { useRequests } from '../hooks/useRequests';
import type { Request } from '../types/requests';

export function RequestDetailHeaderMenus({ request }: { request: Request }) {
  const { t } = useTranslation();
  const {
    openRequestForEdit,
    deleteRequest,
    getDeleteMessage,
    closeRequestPanel,
    sendRequestToList,
  } = useRequests();
  const enabledPlugins = useEnabledPlugins();
  const garmentsEnabled = enabledPlugins.has('garments');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSendToList, setShowSendToList] = useState(false);
  const [isSendingToList, setIsSendingToList] = useState(false);
  const [targetListName, setTargetListName] = useState<string | null>(null);

  const canSendToList = Boolean(
    garmentsEnabled &&
      request.pluginTarget === 'garments' &&
      !request.pluginRoutedAt &&
      !request.pluginRoutedEntityId,
  );

  useEffect(() => {
    if (!request.pluginTargetId || !garmentsEnabled) {
      setTargetListName(null);
      return;
    }
    let cancelled = false;
    garmentsApi
      .getList(String(request.pluginTargetId))
      .then((list) => {
        if (!cancelled) {
          setTargetListName(list.name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTargetListName(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request.pluginTargetId, garmentsEnabled]);

  const listDisplayName =
    targetListName ||
    (request.pluginTargetId
      ? t('requests.view.unknownList', { id: request.pluginTargetId })
      : t('requests.settings.targetListMissing'));

  const handleSendToListConfirm = async () => {
    setIsSendingToList(true);
    try {
      await sendRequestToList(request.id);
      setShowSendToList(false);
    } catch (error: unknown) {
      setShowSendToList(false);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('requests.view.sendToListError');
      alert(message);
    } finally {
      setIsSendingToList(false);
    }
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openRequestForEdit(request),
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

    if (canSendToList) {
      buttons.push({
        id: 'send-to-list',
        icon: ListPlus,
        label: t('requests.view.sendToList'),
        variant: 'secondary',
        contentClassName: 'text-emerald-600 dark:text-emerald-400',
        onClick: () => setShowSendToList(true),
      });
    }

    return buttons;
  }, [canSendToList, openRequestForEdit, request, t]);

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('requests.view.deleteRequest')}
        message={getDeleteMessage(request)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteRequest(request.id);
          closeRequestPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showSendToList}
        title={t('requests.view.sendToListConfirmTitle')}
        message={t('requests.view.sendToListConfirm', { listName: listDisplayName })}
        confirmText={t('requests.view.sendToListConfirmAction')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void handleSendToListConfirm();
        }}
        onCancel={() => {
          if (!isSendingToList) {
            setShowSendToList(false);
          }
        }}
        variant="warning"
        confirmDisabled={isSendingToList}
      />
    </DetailHeaderMenus>
  );
}
