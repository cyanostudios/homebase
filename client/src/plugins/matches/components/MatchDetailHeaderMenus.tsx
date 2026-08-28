import { Copy, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { cn } from '@/lib/utils';

import { useMatchContext } from '../context/MatchContext';
import type { Match } from '../types/match';

function getMatchActionIconColorClass(actionId: string): string {
  if (actionId === 'create-slot-from-match') {
    return 'text-green-600 dark:text-green-400';
  }
  return '';
}

export function MatchDetailHeaderMenus({ match }: { match: Match }) {
  const { t } = useTranslation();
  const {
    deleteMatch,
    getDeleteMessage,
    closeMatchPanel,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedMatchId,
    detailFooterActions,
  } = useMatchContext();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const duplicateConfig = getDuplicateConfig(match);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'delete',
        icon: Trash2,
        label: t('matches.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
      },
    ];

    if (canDuplicate) {
      buttons.push({
        id: 'duplicate',
        icon: Copy,
        label: t('matches.duplicate'),
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
          contentClassName: cn(getMatchActionIconColorClass(action.id), action.className),
          onClick: () => action.onClick(match),
        });
      }
    }

    return buttons;
  }, [canDuplicate, detailFooterActions, match, t]);

  return (
    <DetailHeaderMenus
      actions={actions}
      actionsLabel={t('matches.headerActions', { defaultValue: t('common.headerActions') })}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: t('nav.match') })}
        message={getDeleteMessage(match)}
        confirmText={t('matches.delete')}
        cancelText={t('matches.cancel')}
        onConfirm={async () => {
          await deleteMatch(match.id);
          setShowDeleteConfirm(false);
          closeMatchPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(match, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedMatchId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('matches.duplicateNameLabel')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
