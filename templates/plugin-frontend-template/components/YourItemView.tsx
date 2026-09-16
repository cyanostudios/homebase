/**
 * Full detail view — see docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md
 * and client/src/plugins/contacts/components/ContactView.tsx.
 */
import { FileText, LayoutGrid } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';

import { YourItemQuickContextPanel } from './YourItemQuickContextPanel';

interface YourItemViewProps {
  item: YourItem;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
  /** @deprecated Mail aside uses full QC + tabs like ContactView; kept for call-site compat. */
  onClosePreview?: () => void;
}

/** EXAMPLE tabs — replace with domain-specific tabs in real plugins. */
type YourItemViewTab = 'overview' | 'details';

const YOUR_ITEM_VIEW_TABS: YourItemViewTab[] = ['overview', 'details'];

function parseYourItemViewTab(value: string | null): YourItemViewTab {
  if (value && YOUR_ITEM_VIEW_TABS.includes(value as YourItemViewTab)) {
    return value as YourItemViewTab;
  }
  return 'overview';
}

export const YourItemView: React.FC<YourItemViewProps> = ({
  item,
  stacked: _stacked = false,
  onClosePreview: _onClosePreview,
}) => {
  const { t } = useTranslation();
  const { openYourItemForEdit } = useYourItems();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseYourItemViewTab(searchParams.get('tab'));

  const setActiveTab = useCallback(
    (tab: YourItemViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  if (!item) {
    return null;
  }

  // EXAMPLE tab chips — Overview | Details (Teams / ContactView headerBelow pattern)
  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {(
        [
          { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
          { id: 'details' as const, label: 'Details', icon: FileText },
        ] as const
      ).map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );

  const overviewCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title="Overview" className="p-6">
        <p className="text-sm text-muted-foreground">
          EXAMPLE overview content — replace with domain fields.
        </p>
      </DetailSection>
    </Card>
  );

  const detailsCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title="Details" className="p-6">
        <div className="space-y-4">
          <div>
            <div className={DETAIL_FIELD_LABEL_CLASS}>Title</div>
            <div className="text-lg font-semibold">{item.title}</div>
          </div>
          <div className="border-t border-border/50 pt-4">
            <div className={DETAIL_FIELD_LABEL_CLASS}>Description</div>
            <div className="whitespace-pre-wrap text-sm">{item.description ?? '—'}</div>
          </div>
          <div className="border-t border-border/50 pt-4">
            <div className={DETAIL_FIELD_LABEL_CLASS}>ID</div>
            <div className="font-mono text-sm">{formatDisplayNumber('your-items', item.id)}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
            <div>
              <div className={DETAIL_FIELD_LABEL_CLASS}>{t('common.created')}</div>
              <div className="text-sm">{formatDate(item.createdAt)}</div>
            </div>
            <div>
              <div className={DETAIL_FIELD_LABEL_CLASS}>{t('common.updated')}</div>
              <div className="text-sm">{formatDate(item.updatedAt)}</div>
            </div>
          </div>
        </div>
      </DetailSection>
    </Card>
  );

  return (
    <DetailLayout gridClassName="grid-cols-1">
      <div className="space-y-4">
        <YourItemQuickContextPanel
          item={item}
          onEdit={() => openYourItemForEdit(item)}
          variant="full"
          headerBelow={tabChips}
        />

        {activeTab === 'overview' ? overviewCard : null}
        {activeTab === 'details' ? detailsCard : null}
      </div>
    </DetailLayout>
  );
};
