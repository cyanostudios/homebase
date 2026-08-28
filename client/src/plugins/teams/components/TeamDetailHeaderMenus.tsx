import { Copy, Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';

import { useTeams } from '../hooks/useTeams';
import type { Team } from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';

export function TeamDetailHeaderMenus({ team }: { team: Team }) {
  const { t } = useTranslation();
  const {
    openTeamForEdit,
    deleteTeam,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedTeamId,
  } = useTeams();

  const [showDelete, setShowDelete] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const teamLabel = formatTeamLabel(team) || team.name;
  const duplicateConfig = getDuplicateConfig(team);
  const canDuplicate = Boolean(duplicateConfig);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openTeamForEdit(team),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDelete(true),
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
  }, [canDuplicate, openTeamForEdit, team, t]);

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
      <ConfirmDialog
        isOpen={showDelete}
        title={t('teams.view.deleteTeam')}
        message={t('teams.view.deleteConfirm', { name: teamLabel })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDelete(false);
          await deleteTeam(team.id);
        }}
        onCancel={() => setShowDelete(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(team, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedTeamId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('teams.form.nameLabel')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />
    </DetailHeaderMenus>
  );
}
