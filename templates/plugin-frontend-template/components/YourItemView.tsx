import React from 'react';
import { Edit, Info, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import type { YourItem } from '../types/your-items';
import { useYourItems } from '../hooks/useYourItems';

interface YourItemViewProps {
  item: YourItem;
}

export const YourItemView: React.FC<YourItemViewProps> = ({ item }) => {
  const { t } = useTranslation();
  const { openYourItemForEdit, deleteYourItem } = useYourItems();
  if (!item) return null;

  const created = new Date(item.createdAt).toLocaleDateString();
  const updated = new Date(item.updatedAt).toLocaleDateString();

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-4">
          <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
            <DetailSection title="Quick actions" icon={Edit} iconPlugin="your-items" className="p-4">
              <div className="flex flex-col items-start gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Edit}
                  className="h-9 justify-start rounded-md px-3 text-xs"
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
                  onClick={() => void deleteYourItem(item.id)}
                >
                  {t('common.delete')}
                </Button>
              </div>
            </DetailSection>
          </Card>
          <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
            <DetailSection title="Information" icon={Info} iconPlugin="your-items" className="p-4">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono">{formatDisplayNumber('your-items', item.id)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{created}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{updated}</span>
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
      <Card padding="none" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        <DetailSection title="Details" className="p-6">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </div>
            <div className="text-lg font-semibold">{item.title}</div>
          </div>
          <div className="border-t border-border/50 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </div>
            <div className="whitespace-pre-wrap text-sm">{item.description ?? '—'}</div>
          </div>
        </DetailSection>
      </Card>
    </DetailLayout>
  );
};
