import { Grid3x3, List, Settings, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useKiosk } from '../hooks/useKiosk';
import type { Slot } from '../types/kiosk';

const KIOSK_SETTINGS_KEY = 'kiosk';
type ViewMode = 'grid' | 'list';
type SortField = 'slot_time' | 'location' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function KioskList() {
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
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, _setSortField] = useState<SortField>('slot_time');
  const [sortOrder, _setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(KIOSK_SETTINGS_KEY)
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
      updateSettings(KIOSK_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = slots.filter((s) => {
      if (!needle) {
        return true;
      }
      return (s.location ?? '').toLowerCase().includes(needle);
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
  }, [slots, searchTerm, sortField, sortOrder]);

  const handleOpenForView = (slot: Slot) => attemptNavigation(() => openSlotForView(slot));

  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by location..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openSlotSettings()}
              className="h-7 text-[10px] px-2"
              title="Settings"
            >
              Settings
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'secondary'}
              size="sm"
              icon={Grid3x3}
              onClick={() => setViewMode('grid')}
              className="h-7 text-[10px] px-2"
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'secondary'}
              size="sm"
              icon={List}
              onClick={() => setViewMode('list')}
              className="h-7 text-[10px] px-2"
            >
              List
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
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

  return (
    <div className="space-y-4 plugin-kiosk">
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          onSelectAll={() => selectAllSlots(slots.map((s) => s.id))}
          onClearSelection={clearSlotSelection}
          actions={[
            {
              id: 'bulk-delete',
              label: 'Delete',
              icon: Trash2,
              onClick: () => setShowBulkDeleteModal(true),
              variant: 'destructive',
            },
          ]}
        />
      )}

      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemLabel="slots"
        count={selectedCount}
        isDeleting={deleting}
      />

      {filteredAndSorted.length === 0 ? (
        <Card className="shadow-none p-6 text-center text-muted-foreground">
          {searchTerm
            ? 'No slots match your search.'
            : 'No slots yet. Click "Add Slot" to add one.'}
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
                    ? 'plugin-kiosk bg-plugin-subtle ring-1 border-plugin-subtle'
                    : 'hover:border-plugin-subtle hover:plugin-kiosk hover:shadow-md',
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
                data-plugin-name="kiosk"
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
                    aria-label={selected ? 'Deselect' : 'Select'}
                  />
                </div>
                <h3 className="font-semibold text-sm">{slot.location || '—'}</h3>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(slot.slot_time)} · Capacity {slot.capacity}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {slot.visible ? 'Visible' : 'Hidden'} · Notifications{' '}
                  {slot.notifications_enabled ? 'on' : 'off'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-auto pt-2">
                  {slot.updated_at ? new Date(slot.updated_at).toLocaleDateString('sv-SE') : '—'}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-none plugin-kiosk">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead className="text-right">Updated</TableHead>
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
                  data-plugin-name="kiosk"
                  role="button"
                  aria-label={`Open ${slot.location || 'Slot'} ${formatDateTime(slot.slot_time)}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected(slot.id)}
                      onChange={() => toggleSlotSelected(slot.id)}
                      className="cursor-pointer h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{slot.location || '—'}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(slot.slot_time)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{slot.capacity}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {slot.visible ? 'Yes' : 'No'}
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
