import { Store } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { SortableListTable, type SortableListTableColumn } from '@/core/ui/SortableListTable';
import { formatDateTimeShort } from '@/core/utils/dateFormat';
import { cn } from '@/lib/utils';

import type { Slot } from '../types/slots';
import type { SlotSortField, SlotSortOrder } from '../utils/slotListSort';
import {
  DEFAULT_SLOT_TABLE_COLUMNS,
  type SlotTableColumnId,
  resolveVisibleSlotTableColumns,
} from '../utils/slotTableColumns';

function formatSlotDateTime(s: string | null) {
  return s ? formatDateTimeShort(s) : '—';
}

function slotIdentityMeta(slot: Slot): string | null {
  const parts: string[] = [];
  const location = slot.location?.trim();
  if (location) {
    parts.push(location);
  }
  const when = slot.slot_time ? formatDateTimeShort(slot.slot_time) : '';
  if (when) {
    parts.push(when);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

type SlotTableColumnField = SlotSortField | 'created_at' | 'updated_at';

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
  selectionEnabled?: boolean;
  visibleColumnIds?: SlotTableColumnId[];
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
  selectionEnabled = true,
  visibleColumnIds,
}: SlotListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleSlotTableColumns({ tableColumns: DEFAULT_SLOT_TABLE_COLUMNS });
  }, [visibleColumnIds]);

  const columnDefs = useMemo(() => {
    const defs: Record<SlotTableColumnId, SortableListTableColumn<Slot, SlotTableColumnField>> = {
      name: {
        field: 'name',
        header: t('slots.nameLabel'),
        cell: (slot) => {
          const label = slot.name?.trim() || `SLT ${slot.id}`;
          const identityMeta = slotIdentityMeta(slot);
          return (
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span title={t('nav.slots')} className="inline-flex shrink-0">
                  <SectionCategoryIcon
                    icon={Store}
                    className="h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3"
                  />
                </span>
                <span
                  className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                  title={label}
                >
                  {label}
                </span>
              </div>
              {identityMeta ? (
                <span
                  className="pl-6 text-[10px] font-medium leading-3 text-slate-400 dark:text-slate-500"
                  title={identityMeta}
                >
                  <span className="block truncate">{identityMeta}</span>
                </span>
              ) : null}
            </div>
          );
        },
      },
      category: {
        field: 'category',
        header: t('slots.categoryLabel'),
        className: 'hidden sm:table-cell',
        cell: (slot) =>
          slot.category?.trim() ? (
            <Badge
              className={cn(BADGE_CHIP_CLASS, 'max-w-full truncate bg-muted text-muted-foreground')}
            >
              {slot.category.trim()}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      location: {
        field: 'location',
        header: t('slots.locationLabel'),
        className: 'hidden md:table-cell',
        cell: (slot) => {
          const location = slot.location?.trim() || '—';
          return (
            <span
              className="block min-w-0 truncate text-xs text-muted-foreground"
              title={location !== '—' ? location : undefined}
            >
              {location}
            </span>
          );
        },
      },
      slot_time: {
        field: 'slot_time',
        header: t('slots.timeLabel'),
        cell: (slot) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {formatSlotDateTime(slot.slot_time ?? null)}
          </span>
        ),
      },
      visible: {
        field: 'visible',
        header: t('common.visible'),
        cell: (slot) => (
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
      booked_count: {
        field: 'booked_count',
        header: t('slots.publicBookings'),
        className: 'hidden lg:table-cell',
        cell: (slot) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {slot.booked_count ?? 0}
          </span>
        ),
      },
      created_at: {
        field: 'created_at',
        header: t('common.created'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (slot) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(slot.created_at) || '—'}
          </span>
        ),
      },
      updated_at: {
        field: 'updated_at',
        header: t('common.updated'),
        className: 'hidden lg:table-cell',
        sortable: false,
        cell: (slot) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTimeShort(slot.updated_at) || '—'}
          </span>
        ),
      },
    };
    return defs;
  }, [t]);

  const columns = useMemo(
    () =>
      orderedVisibleIds
        .map((id) => columnDefs[id])
        .filter((col): col is SortableListTableColumn<Slot, SlotTableColumnField> => Boolean(col)),
    [orderedVisibleIds, columnDefs],
  );

  return (
    <SortableListTable
      rows={slots}
      columns={columns}
      getRowId={(slot) => String(slot.id)}
      primarySort={primarySort}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === 'created_at' || field === 'updated_at') {
          return;
        }
        onSort(field);
      }}
      onRowClick={onRowClick}
      rowAriaLabel={(slot) => slot.name?.trim() || `SLT ${slot.id}`}
      rowClassName={(slot) =>
        recentlyDuplicatedSlotId === String(slot.id)
          ? 'bg-green-50 dark:bg-green-950/30'
          : undefined
      }
      isRowActive={(slot) => activeSlotId != null && String(slot.id) === String(activeSlotId)}
      selection={
        selectionEnabled
          ? {
              isSelected,
              onCheckboxMouseDown,
              onCheckboxChange,
              allVisibleSelected,
              onHeaderCheckboxChange,
              selectAllAriaLabel: t('common.selectAllVisible'),
              selectRowAriaLabel: (selected) =>
                selected ? t('common.unselectRow') : t('common.selectRow'),
            }
          : undefined
      }
      subtleRowDividers
      headerBarClassName="bg-sky-50 dark:bg-sky-950/40"
      headerCellClassName="text-sky-800 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-900/40"
      pluginName="slots"
      dataListItem={(slot) => slot}
    />
  );
}
