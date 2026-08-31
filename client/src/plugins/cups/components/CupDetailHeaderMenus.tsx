import { Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useCups } from '../hooks/useCups';
import type { Cup } from '../types/cups';

export function CupDetailHeaderMenus({ cup }: { cup: Cup }) {
  const { t } = useTranslation();
  const { openCupForEdit, deleteCup, getDeleteMessage } = useCups();

  const [showDelete, setShowDelete] = useState(false);

  const actions = useMemo(
    (): DetailHeaderMenuAction[] => [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openCupForEdit(cup),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDelete(true),
      },
    ],
    [cup, openCupForEdit, t],
  );

  return (
    <DetailHeaderMenus actions={actions} actionsLabel={t('common.headerActions')}>
      <ConfirmDialog
        isOpen={showDelete}
        title="Delete cup?"
        message={getDeleteMessage(cup)}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          await deleteCup(cup.id);
          setShowDelete(false);
        }}
        onCancel={() => setShowDelete(false)}
        variant="danger"
      />
    </DetailHeaderMenus>
  );
}
