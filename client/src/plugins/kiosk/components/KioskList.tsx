import { ArrowDown, ArrowUp, FileSpreadsheet, Grid3x3, List, MessageSquare, Settings, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkMessageDialog } from '@/core/ui/BulkMessageDialog';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';
import { cn } from '@/lib/utils';

import { useKiosk } from '../hooks/useKiosk';
import type { Slot } from '../types/kiosk';
import { resolveSlotsToContacts } from '../utils/slotContactUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';

const SLOTS_SETTINGS_KEY = 'slots';
type ViewMode = 'grid' | 'list';
type SortField = 'slot_time' | 'location' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function KioskList() {
  const { t } = useTranslation();
  const {
    slots,
    openSlotPanel,
    openSlotForView,
    openSlotSettings,
    deleteSlot: _deleteSlot,
    deleteSlots,
    selectedSlotIds,
    toggleSlotSelected,
    selectAllSlots,
    clearSlotSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedSlotId,
  } = useKiosk();
  const { getSettings, updateSettings, settingsVersion, contacts: appContacts } = useApp();
  const { contacts: hookContacts } = useContacts();
  const contacts = appContacts ?? hookContacts ?? [];
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('slot_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (!cancelled) {
          setViewModeState(settings?.viewMode === 'grid' ? 'grid' : 'list');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      updateSettings(SLOTS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const formatDateTimeForFilter = useCallback(
    (s: string | null) =>
      s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '',
    [],
  );

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = slots.filter((s) => {
      if (!needle) {
        return true;
      }
      const timeStr = formatDateTimeForFilter(s.slot_time ?? null).toLowerCase();
      return (s.location ?? '').toLowerCase().includes(needle) || timeStr.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'slot_time':
          aVal = a.slot_time ? new Date(a.slot_time).getTime() : 0;
          bVal = b.slot_time ? new Date(b.slot_time).getTime() : 0;
          return sortOrder === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        case 'location':
          aVal = (a.location ?? '').toLowerCase();
          bVal = (b.location ?? '').toLowerCase();
          break;
        case 'updatedAt':
          aVal = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bVal = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return sortOrder === 'asc'
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        default:
          aVal = '';
          bVal = '';
      }
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [slots, searchTerm, sortField, sortOrder, formatDateTimeForFilter]);

  const visibleSlotIds = useMemo(() => filteredAndSorted.map((s) => s.id), [filteredAndSorted]);
  const allVisibleSelected = useMemo(
    () => visibleSlotIds.length > 0 && visibleSlotIds.every((id) => isSelected(id)),
    [visibleSlotIds, isSelected],
  );
  const someVisibleSelected = useMemo(
    () => visibleSlotIds.some((id) => isSelected(id)),
    [visibleSlotIds, isSelected],
  );
  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);
  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleSlotIds);
      const remaining = selectedSlotIds.filter((id) => !set.has(id));
      selectAllSlots(remaining);
    } else {
      const union = Array.from(new Set([...selectedSlotIds, ...visibleSlotIds]));
      selectAllSlots(union);
    }
  }, [allVisibleSelected, visibleSlotIds, selectedSlotIds, selectAllSlots]);

  const handleOpenForView = (slot: Slot) => attemptNavigation(() => openSlotForView(slot));

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('slots.searchPlaceholder')}
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openSlotSettings()}
              className="h-7 text-[10px] px-2"
              title={t('slots.settings')}
            >
              {t('slots.settings')}
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className="h-7 text-[10px] px-2"
            >
              {t('slots.grid')}
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              icon={List}
              onClick={() => setViewMode('list')}
              className="h-7 text-[10px] px-2"
            >
              {t('slots.list')}
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    t,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    setHeaderTrailing,
    openSlotSettings,
    openSlotPanel,
    attemptNavigation,
  ]);

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteSlots(selectedSlotIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteSlots, selectedSlotIds]);

  const formatDateTime = (s: string | null) =>
    s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const bulkMessageRecipients = useMemo(
    () =>
      resolveSlotsToContacts(selectedSlotIds, slots, contacts as Array<{ id: string | number; companyName?: string; phone?: string; phone2?: string }>),
    [selectedSlotIds, slots, contacts],
  );

  const handleBulkExportCSV = useCallback(() => {
    const selectedSlots = slots.filter((s) => selectedSlotIds.includes(s.id));
    exportItems({
      items: selectedSlots,
      format: 'csv',
      filename: `slots-export-${new Date().toISOString().split('T')[0]}`,
      config: {
        csv: {
          headers: ['id', 'location', 'slot_time', 'capacity', 'visible', 'notifications_enabled', 'mention_count', 'created_at', 'updated_at'],
          mapItemToRow: (s: Slot) => ({
            id: s.id,
            location: s.location ?? '',
            slot_time: s.slot_time ? new Date(s.slot_time).toLocaleString('sv-SE') : '',
            capacity: s.capacity,
            visible: s.visible ? t('common.yes') : t('common.no'),
            notifications_enabled: s.notifications_enabled ? t('common.on') : t('common.off'),
            mention_count: (s.mentions?.length ?? 0),
            created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('sv-SE') : '',
            updated_at: s.updated_at ? new Date(s.updated_at).toLocaleDateString('sv-SE') : '',
          }),
        },
      },
    });
  }, [slots, selectedSlotIds, t]);

  return (
    <div className="space-y-4 plugin-slots">
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClearSelection={clearSlotSelection}
          actions={[
            {
              label: t('bulk.sendMessageTitle'),
              icon: MessageSquare,
              onClick: () => setShowBulkMessageDialog(true),
            },
            {
              label: t('common.exportCsv'),
              icon: FileSpreadsheet,
              onClick: handleBulkExportCSV,
            },
            {
              label: t('common.delete'),
              icon: Trash2,
              onClick: () => setShowBulkDeleteModal(true),
              variant: 'destructive',
            },
          ]}
        />
      )}

      <BulkMessageDialog
        isOpen={showBulkMessageDialog}
        onClose={() => setShowBulkMessageDialog(false)}
        recipients={bulkMessageRecipients}
        pluginSource="slots"
      />

      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="slots"
        isLoading={deleting}
      />

      {filteredAndSorted.length === 0 ? (
        <Card className="shadow-none p-6 text-center text-muted-foreground">
          {searchTerm ? t('slots.noSlotsMatch') : t('slots.noSlotsYet')}
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSorted.map((slot) => {
            const selected = isSelected(slot.id);
            return (
              <Card
                key={slot.id}
                className={cn(
                  'relative p-5 cursor-pointer transition-all flex flex-col min-h-[140px] border-transparent bg-gray-50 dark:bg-gray-900/40',
                  selected
                    ? 'plugin-slots bg-plugin-subtle ring-1 border-plugin-subtle'
                    : 'hover:border-plugin-subtle hover:plugin-slots hover:shadow-md',
                  recentlyDuplicatedSlotId === String(slot.id) &&
                    'bg-green-50 dark:bg-green-950/30',
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                    return;
                  }
                  handleOpenForView(slot);
                }}
                data-list-item={JSON.stringify(slot)}
                data-plugin-name="slots"
                role="button"
                aria-label={`Open ${slot.location || 'Slot'} ${formatDateTime(slot.slot_time)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSlotSelected(slot.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer h-4 w-4"
                    aria-label={selected ? t('common.deselect') : t('common.select')}
                  />
                </div>
                <h3 className="font-semibold text-sm">{slot.location || '—'}</h3>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(slot.slot_time)} · {t('common.capacity')} {slot.capacity}{' '}
                  <CapacityAssignedDots
                    capacity={slot.capacity}
                    assignedCount={slot.mentions?.length ?? 0}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {slot.visible ? t('common.visible') : t('common.hidden')} ·{' '}
                  {t('common.notifications')}{' '}
                  {slot.notifications_enabled ? t('common.on') : t('common.off')}
                </div>
                <div className="text-[10px] text-muted-foreground mt-auto pt-2">
                  {slot.updated_at ? new Date(slot.updated_at).toLocaleDateString('sv-SE') : '—'}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-none plugin-slots">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer"
                    aria-label={
                      allVisibleSelected ? t('common.unselectAll') : t('common.selectAll')
                    }
                    checked={allVisibleSelected}
                    onChange={onToggleAllVisible}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => {
                    if (sortField === 'location') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('location');
                      setSortOrder('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span>{t('common.location')}</span>
                    {sortField === 'location' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => {
                    if (sortField === 'slot_time') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('slot_time');
                      setSortOrder('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span>{t('common.time')}</span>
                    {sortField === 'slot_time' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
                <TableHead>{t('common.capacity')}</TableHead>
                <TableHead>{t('common.visible')}</TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => {
                    if (sortField === 'updatedAt') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('updatedAt');
                      setSortOrder('asc');
                    }
                  }}
                >
                  <div className="flex items-center justify-end gap-2">
                    <span>{t('common.updated')}</span>
                    {sortField === 'updatedAt' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="h-3 w-3 inline" />
                      ) : (
                        <ArrowDown className="h-3 w-3 inline" />
                      ))}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((slot) => (
                <TableRow
                  key={slot.id}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    isSelected(slot.id) && 'bg-plugin-subtle',
                    recentlyDuplicatedSlotId === String(slot.id) &&
                      'bg-green-50 dark:bg-green-950/30',
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    handleOpenForView(slot);
                  }}
                  data-list-item={JSON.stringify(slot)}
                  data-plugin-name="slots"
                  role="button"
                  aria-label={`Open ${slot.location || 'Slot'} ${formatDateTime(slot.slot_time)}`}
                >
                  <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(slot.id)}
                      onChange={() => toggleSlotSelected(slot.id)}
                      className="cursor-pointer h-4 w-4"
                      aria-label={
                        isSelected(slot.id) ? t('common.unselectSlot') : t('common.selectSlot')
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{slot.location || '—'}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(slot.slot_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      {slot.capacity}
                      <CapacityAssignedDots
                        capacity={slot.capacity}
                        assignedCount={slot.mentions?.length ?? 0}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {slot.visible ? t('common.yes') : t('common.no')}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {slot.updated_at ? new Date(slot.updated_at).toLocaleDateString('sv-SE') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
