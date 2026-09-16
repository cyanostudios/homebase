/**
 * Thin DetailHeaderMenus wrapper — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/contacts/components/ContactDetailHeaderMenus.tsx.
 */
import { Edit, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';

export function YourItemDetailHeaderMenus({
  item,
  leading,
}: {
  item: YourItem;
  /** Optional leading content on the Actions row (e.g. item title). */
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { openYourItemForEdit, deleteYourItem, getDeleteMessage, closeYourItemPanel } =
    useYourItems();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    return [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openYourItemForEdit(item),
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
  }, [item, openYourItemForEdit, t]);

  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      actionsLabel={t('common.actions', { defaultValue: 'Actions' })}
    >
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: 'item' })}
        message={getDeleteMessage(item)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          void deleteYourItem(item.id);
          setShowDeleteConfirm(false);
          closeYourItemPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </DetailHeaderMenus>
  );
}
