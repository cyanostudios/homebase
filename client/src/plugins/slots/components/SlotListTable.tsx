import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { SortableListTable } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Slot } from '../types/slots';
import type { SlotSortField, SlotSortOrder } from '../utils/slotListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function formatSlotDateTime(s: string | null) {
  return s ? formatDateTimeShort(s) : '—';
}

export type SlotListTableProps = {
  slots: Slot[];
  primarySort: SlotSortField;
  sortOrder: SlotSortOrder;
  onSort: (field: SlotSortField) => void;
  isSelected: (id: string) => boolean;
  onRowClick: (slot: Slot) => void;
  onCheckboxMouseDown: (event: React.MouseEvent, index: number) => void;
  onCheckboxChange: (id: string) => void;
  allVisibleSelected: boolean;
  onHeaderCheckboxChange: () => void;
  recentlyDuplicatedSlotId: string | null;
  activeSlotId?: string | number | null;
};

export function SlotListTable({
  slots,
  primarySort,
  sortOrder,
  onSort,
  isSelected,
  onRowClick,
  onCheckboxMouseDown,
  onCheckboxChange,
  allVisibleSelected,
  onHeaderCheckboxChange,
  recentlyDuplicatedSlotId,
  activeSlotId = null,
}: SlotListTableProps) {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      {
        field: 'name' as const,
        header: t('slots.nameLabel'),
        cell: (slot: Slot) => (
          <span className="font-medium text-foreground">
            {slot.name?.trim() || `SLT ${slot.id}`}
          </span>
        ),
      },
      {
        field: 'category' as const,
        header: t('slots.categoryLabel'),
        className: 'hidden sm:table-cell',
        cell: (slot: Slot) =>
          slot.category?.trim() ? (
            <Badge className={cn(BADGE_CLASS, 'bg-muted text-muted-foreground')}>
              {slot.category.trim()}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        field: 'location' as const,
        header: t('slots.locationLabel'),
        className: 'hidden md:table-cell',
        cell: (slot: Slot) => (
          <span className="text-xs text-muted-foreground">{slot.location?.trim() || '—'}</span>
        ),
      },
      {
        field: 'slot_time' as const,
        header: t('slots.timeLabel'),
        cell: (slot: Slot) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatSlotDateTime(slot.slot_time ?? null)}
          </span>
        ),
      },
      {
        field: 'visible' as const,
        header: t('common.visible'),
        cell: (slot: Slot) => (
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              slot.visible ? 'bg-emerald-500' : 'bg-red-500',
            )}
            title={slot.visible ? t('common.visible') : t('common.hidden')}
            aria-label={slot.visible ? t('common.visible') : t('common.hidden')}
          />
        ),
      },
      {
        field: 'booked_count' as const,
        header: t('slots.publicBookings'),
        className: 'hidden lg:table-cell',
        cell: (slot: Slot) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {slot.booked_count ?? 0}
          </span>
        ),
      },
      {
        field: 'updatedAt' as const,
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        cell: (slot: Slot) => (
          <span className="text-xs text-muted-foreground">
            {slot.updated_at ? new Date(slot.updated_at).toLocaleDateString('sv-SE') : '—'}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <SortableListTable
      rows={slots}
      columns={columns}
      getRowId={(slot) => String(slot.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={onSort}
      onRowClick={onRowClick}
      rowAriaLabel={(slot) => slot.name?.trim() || `SLT ${slot.id}`}
      rowClassName={(slot) =>
        recentlyDuplicatedSlotId === String(slot.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(slot) => activeSlotId != null && String(slot.id) === String(activeSlotId)}
      selection={{
        isSelected,
        onCheckboxMouseDown,
        onCheckboxChange,
        allVisibleSelected,
        onHeaderCheckboxChange,
        selectAllAriaLabel: t('common.selectAllVisible'),
        selectRowAriaLabel: (selected) =>
          selected ? t('common.unselectRow') : t('common.selectRow'),
      }}
      pluginName="slots"
      dataListItem={(slot) => slot}
    />
  );
}
