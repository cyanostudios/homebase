import {
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  Grid3x3,
  List,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { BulkMessageDialog, type BulkMessageRecipient } from '@/core/ui/BulkMessageDialog';
import { exportItems } from '@/core/utils/exportUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

import { slotsApi } from '../api/slotsApi';
import { useSlotsContext as useSlots } from '../context/SlotsContext';
import type { Slot, SlotsViewMode } from '../types/slots';
import { SLOTS_SETTINGS_KEY } from '../types/slots';
import {
  appendPublicBookingsToEmailRecipients,
  appendPublicBookingsToMessageRecipients,
  formatSlotInfoHtml,
  formatSlotInfoText,
  resolveSlotsToContacts,
  resolveSlotsToEmailContacts,
} from '../utils/slotContactUtils';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { BulkPropertiesDialog } from './BulkPropertiesDialog';
import { CapacityAssignedDots } from './CapacityAssignedDots';
import { SlotsSettingsView } from './SlotsSettingsView';

type SortField = 'name' | 'slot_time' | 'location' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type SlotFilter = 'all' | 'visible' | 'upcoming' | 'withCategory';
const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';
const SLOTS_VIEW_MODE_STORAGE_KEY = 'slots:viewMode';

function StatCard({
  label,
  value,
  dotClassName,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  dotClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-xl border-0 bg-card p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        active && 'ring-1 ring-border/70',
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotClassName)} aria-hidden />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

function getInitialViewMode(): SlotsViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(SLOTS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

export function SlotsList() {
  const { t } = useTranslation();
  const {
    slots,
    slotsContentView,
    openSlotForView,
    openSlotSettings,
    closeSlotSettingsView,
    deleteSlots,
    selectedSlotIds,
    toggleSlotSelected,
    mergeIntoSlotSelection,
    selectAllSlots,
    clearSlotSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedSlotId,
    refreshSlots,
    canSendMessages,
    canSendEmail,
    openSlotPanel,
  } = useSlots();
  const { getSettings, updateSettings, settingsVersion, contacts: appContacts } = useApp();
  const { contacts: hookContacts } = useContacts();
  const contacts = useMemo(() => appContacts ?? hookContacts ?? [], [appContacts, hookContacts]);
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('slot_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeFilter, setActiveFilter] = useState<SlotFilter>('all');
  const [viewMode, setViewModeState] = useState<SlotsViewMode>(getInitialViewMode);
  const [settingsCategory, setSettingsCategory] = useState<'view' | 'categories'>('view');

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkMessageDialog, setShowBulkMessageDialog] = useState(false);
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false);
  const [showBulkPropertiesDialog, setShowBulkPropertiesDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkMessageRecipients, setBulkMessageRecipients] = useState<BulkMessageRecipient[]>([]);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [bulkEmailContextSlots, setBulkEmailContextSlots] = useState<Slot[]>([]);

  const selectedSlots = useMemo(
    () => slots.filter((s) => selectedSlotIds.includes(s.id)),
    [slots, selectedSlotIds],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSettings(SLOTS_SETTINGS_KEY)
      .then((settings: { viewMode?: SlotsViewMode }) => {
        if (!cancelled) {
          const nextMode: SlotsViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
          setViewModeState(nextMode);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(SLOTS_VIEW_MODE_STORAGE_KEY, nextMode);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: SlotsViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SLOTS_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(SLOTS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const formatDateTimeForFilter = useCallback(
    (s: string | null) =>
      s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '',
    [],
  );

  const formatDateTime = (s: string | null) =>
    s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  const filteredAndSorted = useMemo(() => {
    const byFilter = slots.filter((s) => {
      if (activeFilter === 'visible') {
        return Boolean(s.visible);
      }
      if (activeFilter === 'upcoming') {
        return new Date(s.slot_time).getTime() > Date.now();
      }
      if (activeFilter === 'withCategory') {
        return Boolean(s.category?.trim());
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((s) => {
      if (!needle) {
        return true;
      }
      const timeStr = formatDateTimeForFilter(s.slot_time ?? null).toLowerCase();
      const nameStr = (s.name ?? '').toLowerCase();
      const locationStr = (s.location ?? '').toLowerCase();
      return nameStr.includes(needle) || locationStr.includes(needle) || timeStr.includes(needle);
    });
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'name':
          aVal = (a.name?.trim() || a.location || '').toLowerCase();
          bVal = (b.name?.trim() || b.location || '').toLowerCase();
          break;
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
  }, [slots, searchTerm, sortField, sortOrder, formatDateTimeForFilter, activeFilter]);
  const stats = useMemo(
    () => ({
      total: slots.length,
      visible: slots.filter((s) => Boolean(s.visible)).length,
      upcoming: slots.filter((s) => new Date(s.slot_time).getTime() > Date.now()).length,
      withCategory: slots.filter((s) => Boolean(s.category?.trim())).length,
    }),
    [slots],
  );

  const visibleSlotIds = useMemo(
    () => filteredAndSorted.map((s) => String(s.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleSlotIds,
      mergeIntoSelection: mergeIntoSlotSelection,
      toggleOne: toggleSlotSelected,
    });

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

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteSlots(selectedSlotIds);
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteSlots, selectedSlotIds]);

  const openBulkMessageDialog = useCallback(async () => {
    const base = resolveSlotsToContacts(
      selectedSlotIds,
      slots,
      contacts as Array<{
        id: string | number;
        companyName?: string;
        phone?: string;
        phone2?: string;
      }>,
    );
    try {
      const lists = await Promise.all(selectedSlotIds.map((id) => slotsApi.getBookings(id)));
      setBulkMessageRecipients(appendPublicBookingsToMessageRecipients(base, lists.flat()));
    } catch {
      setBulkMessageRecipients(base);
    }
    setShowBulkMessageDialog(true);
  }, [selectedSlotIds, slots, contacts]);

  const openBulkEmailDialog = useCallback(async () => {
    const base = resolveSlotsToEmailContacts(
      selectedSlotIds,
      slots,
      contacts as Array<{
        id: string | number;
        companyName?: string;
        email?: string;
      }>,
    );
    try {
      const lists = await Promise.all(selectedSlotIds.map((id) => slotsApi.getBookings(id)));
      setBulkEmailRecipients(appendPublicBookingsToEmailRecipients(base, lists.flat()));
    } catch {
      setBulkEmailRecipients(base);
    }
    setBulkEmailContextSlots(selectedSlots);
    setShowBulkEmailDialog(true);
  }, [selectedSlotIds, selectedSlots, slots, contacts]);

  const closeBulkMessageDialog = useCallback(() => {
    setShowBulkMessageDialog(false);
    setBulkMessageRecipients([]);
  }, []);

  const closeBulkEmailDialog = useCallback(() => {
    setShowBulkEmailDialog(false);
    setBulkEmailRecipients([]);
    setBulkEmailContextSlots([]);
  }, []);

  const handleBulkExportCSV = useCallback(() => {
    exportItems({
      items: selectedSlots,
      format: 'csv',
      filename: `slots-export-${new Date().toISOString().split('T')[0]}`,
      config: {
        csv: {
          headers: [
            'id',
            'location',
            'slot_time',
            'capacity',
            'visible',
            'notifications_enabled',
            'mention_count',
            'created_at',
            'updated_at',
          ],
          mapItemToRow: (s: Slot) => ({
            id: s.id,
            location: s.location ?? '',
            slot_time: s.slot_time ? new Date(s.slot_time).toLocaleString('sv-SE') : '',
            capacity: s.capacity,
            visible: s.visible ? t('common.yes') : t('common.no'),
            notifications_enabled: s.notifications_enabled ? t('common.on') : t('common.off'),
            mention_count: s.mentions?.length ?? 0,
            created_at: s.created_at ? new Date(s.created_at).toLocaleDateString('sv-SE') : '',
            updated_at: s.updated_at ? new Date(s.updated_at).toLocaleDateString('sv-SE') : '',
          }),
        },
      },
    });
  }, [selectedSlots, t]);

  if (slotsContentView === 'settings') {
    return (
      <div className="plugin-slots min-h-full bg-background">
        <div className="px-6 py-4">
          <SlotsSettingsView
            selectedCategory={settingsCategory}
            onSelectedCategoryChange={setSettingsCategory}
            renderCategoryButtonsInline
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeSlotSettingsView}
              >
                {t('common.close')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-slots min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.slots')}</h2>
            <p className="text-sm text-muted-foreground">{t('slots.listDescription')}</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            className="h-9 px-3 text-xs"
            onClick={() => attemptNavigation(() => openSlotPanel(null))}
          >
            {t('slots.addSlot')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="Visible"
            value={stats.visible}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'visible'}
            onClick={() => setActiveFilter('visible')}
          />
          <StatCard
            label="Upcoming"
            value={stats.upcoming}
            dotClassName="bg-amber-500"
            active={activeFilter === 'upcoming'}
            onClick={() => setActiveFilter('upcoming')}
          />
          <StatCard
            label="With Category"
            value={stats.withCategory}
            dotClassName="bg-violet-500"
            active={activeFilter === 'withCategory'}
            onClick={() => setActiveFilter('withCategory')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearSlotSelection}
            actions={[
              ...(canSendMessages
                ? [
                    {
                      label: t('bulk.sendMessageTitle'),
                      icon: MessageSquare,
                      onClick: openBulkMessageDialog,
                    },
                  ]
                : []),
              ...(canSendEmail
                ? [
                    {
                      label: t('bulk.sendEmailTitle'),
                      icon: Mail,
                      onClick: openBulkEmailDialog,
                    },
                  ]
                : []),
              {
                label: t('slots.properties'),
                icon: SlidersHorizontal,
                onClick: () => setShowBulkPropertiesDialog(true),
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
          onClose={closeBulkMessageDialog}
          recipients={bulkMessageRecipients}
          pluginSource="slots"
          showRecipientSelection
        />

        <BulkEmailDialog
          isOpen={showBulkEmailDialog}
          onClose={closeBulkEmailDialog}
          recipients={bulkEmailRecipients}
          pluginSource="slots"
          showRecipientSelection
          additionalText={
            bulkEmailContextSlots.length > 0
              ? bulkEmailContextSlots.map((s) => formatSlotInfoText(s)).join('\n\n')
              : undefined
          }
          additionalHtml={
            bulkEmailContextSlots.length > 0
              ? bulkEmailContextSlots.map((s) => formatSlotInfoHtml(s)).join('')
              : undefined
          }
        />

        <BulkPropertiesDialog
          isOpen={showBulkPropertiesDialog}
          onClose={() => setShowBulkPropertiesDialog(false)}
          selectedSlots={selectedSlots}
          onSuccess={async () => {
            await refreshSlots();
            clearSlotSelection();
          }}
        />

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="slots"
          isLoading={deleting}
        />

        <Card
          className={cn(
            'rounded-xl border-0',
            viewMode === 'grid'
              ? 'overflow-visible bg-transparent shadow-none'
              : 'overflow-hidden bg-white shadow-sm dark:bg-slate-950',
          )}
        >
          <div
            className={cn(
              'flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('slots.searchPlaceholder', { count: slots.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openSlotSettings()}
                title={t('slots.settings')}
              >
                {t('slots.settings')}
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Grid3x3}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  {t('slots.grid')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={List}
                  className={cn(
                    'h-7 rounded-[6px] px-2 text-xs',
                    viewMode === 'list'
                      ? 'bg-background text-foreground shadow-sm hover:bg-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setViewMode('list')}
                >
                  {t('slots.list')}
                </Button>
              </div>
            </div>
          </div>

          {filteredAndSorted.length === 0 ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-muted-foreground">
                {searchTerm ? t('slots.noSlotsMatch') : t('slots.noSlotsYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSorted.map((slot, index) => {
                const selected = isSelected(slot.id);
                return (
                  <Card
                    key={slot.id}
                    className={cn(
                      'relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
                      selected
                        ? 'plugin-slots bg-plugin-subtle ring-1 border-plugin-subtle'
                        : 'hover:border-plugin-subtle hover:plugin-slots hover:shadow-md',
                      recentlyDuplicatedSlotId === String(slot.id) && HIGHLIGHT_CLASS,
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      handleOpenForView(slot);
                    }}
                    role="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(slot.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={selected ? t('common.deselect') : t('common.select')}
                      />
                      {slot.category?.trim() && (
                        <Badge className="border-0 rounded-md px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {slot.category.trim()}
                        </Badge>
                      )}
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold leading-snug">
                      {slot.name?.trim() || `SLT ${slot.id}`}
                    </h3>
                    <div className="truncate text-xs text-muted-foreground">
                      {slot.location?.trim() || '—'}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          isSlotTimePast(slot.slot_time) &&
                            'font-medium text-red-600 dark:text-red-400',
                        )}
                      >
                        {formatDateTime(slot.slot_time)}
                      </span>
                      <span>
                        {t('common.capacity')} {slot.capacity}{' '}
                        <CapacityAssignedDots
                          capacity={slot.capacity}
                          assignedCount={(slot.mentions?.length ?? 0) + (slot.booked_count ?? 0)}
                        />
                      </span>
                    </div>
                    <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
                      <div>Updated: {new Date(slot.updated_at).toLocaleDateString('sv-SE')}</div>
                      <div>Created: {new Date(slot.created_at).toLocaleDateString('sv-SE')}</div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead className="w-12 text-xs">
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
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => {
                        if (sortField === 'name') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField('name');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('slots.nameLabel')}</span>
                        {sortField === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
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
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
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
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">{t('common.capacity')}</TableHead>
                    <TableHead className="text-xs">
                      {t('common.visible')} / {t('common.notifications')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((slot, index) => (
                    <TableRow
                      key={slot.id}
                      className={cn(
                        'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                        isSelected(slot.id) && 'bg-plugin-subtle',
                        recentlyDuplicatedSlotId === String(slot.id) && HIGHLIGHT_CLASS,
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        handleOpenForView(slot);
                      }}
                      role="button"
                    >
                      <TableCell className="w-12 text-xs" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected(slot.id)}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(slot.id)}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={
                            isSelected(slot.id) ? t('common.unselectSlot') : t('common.selectSlot')
                          }
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{slot.name?.trim() || `SLT ${slot.id}`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{slot.location || '—'}</span>
                          {slot.category?.trim() && (
                            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                              {slot.category.trim()}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-sm',
                          isSlotTimePast(slot.slot_time)
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatDateTime(slot.slot_time)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {slot.capacity}
                          <CapacityAssignedDots
                            capacity={slot.capacity}
                            assignedCount={(slot.mentions?.length ?? 0) + (slot.booked_count ?? 0)}
                          />
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slot.visible ? t('common.yes') : t('common.no')} ·{' '}
                        {slot.notifications_enabled ? t('common.on') : t('common.off')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            Showing {filteredAndSorted.length} of {slots.length} Slots
          </div>
        </Card>
      </div>
    </div>
  );
}
