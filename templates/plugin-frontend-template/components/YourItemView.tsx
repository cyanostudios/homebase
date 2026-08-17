import React, { useState } from 'react';
import { Edit, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailLayout } from '@/core/ui/DetailLayout';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_INFO_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import type { YourItem } from '../types/your-items';
import { useYourItems } from '../hooks/useYourItems';

interface YourItemViewProps {
  item: YourItem;
}

export const YourItemView: React.FC<YourItemViewProps> = ({ item }) => {
  const { t } = useTranslation();
  const { openYourItemForEdit, deleteYourItem, getDeleteMessage } = useYourItems();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!item) return null;

  const created = formatDate(item.createdAt);
  const updated = formatDate(item.updatedAt);

  const handleConfirmDelete = async () => {
    await deleteYourItem(item.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title="Quick actions"
                icon={Edit}
                iconPlugin="your-items"
                className="p-4"
              >
                <div className="flex flex-col items-start gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    className={cn(DETAIL_QUICK_ACTION_ROW_CLASS)}
                    onClick={() => openYourItemForEdit(item)}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </DetailSection>
            </Card>
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title="Information"
                icon={Info}
                iconPlugin="your-items"
                subtleTitle
                className="p-4"
                collapsible
              >
                <div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">ID</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatDisplayNumber('your-items', item.id)}
                    </span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Created</span>
                    <span className="font-mono font-semibold text-foreground">{created}</span>
                  </div>
                  <div className={DETAIL_INFO_ROW_CLASS}>
                    <span className="text-slate-500 dark:text-slate-400">Updated</span>
                    <span className="font-mono font-semibold text-foreground">{updated}</span>
                  </div>
                </div>
              </DetailSection>
            </Card>
            <DetailActivityLog
              entityType="your_item"
              entityId={item.id}
              title="Activity"
              refreshKey={item.updatedAt}
            />
          </div>
        }
      >
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection title="Details" className="p-6">
            <div className="space-y-1">
              <div className={DETAIL_FIELD_LABEL_CLASS}>Title</div>
              <div className="text-lg font-semibold">{item.title}</div>
            </div>
            <div className="border-t border-border/50 pt-4">
              <div className={DETAIL_FIELD_LABEL_CLASS}>Description</div>
              <div className="whitespace-pre-wrap text-sm">{item.description ?? '—'}</div>
            </div>
          </DetailSection>
        </Card>
      </DetailLayout>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('dialog.deleteItem', { label: 'item' })}
        message={getDeleteMessage(item)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  );
};
