import { Grid3x3, List, Plus, Search, Settings, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useSlotsContext as useSlots } from '../context/SlotsContext';
import type { SlotsViewMode } from '../types/slots';
import { isSlotTimePast } from '../utils/slotTimeUtils';

import { CapacityAssignedDots } from './CapacityAssignedDots';
import { SlotsSettingsView } from './SlotsSettingsView';

/**
 * Draft sandbox for rebuilding Slots list view.
 * Keep the exact wrapper geometry and only add header controls.
 */
export function SlotsListDraft() {
  const { t } = useTranslation();
  const {
    slots,
    slotsContentView,
    openSlotForView,
    openSlotPanel,
    openSlotSettings,
    closeSlotSettingsView,
  } = useSlots();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<SlotsViewMode>('list');
  const [settingsCategory, setSettingsCategory] = useState<'view' | 'categories'>('view');

  const formatDateTime = (s: string | null) =>
    s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const formatDateTimeForFilter = (s: string | null) =>
    s ? new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const filteredSlots = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return slots;
    }
    return slots.filter((slot) => {
      const timeStr = formatDateTimeForFilter(slot.slot_time).toLowerCase();
      return (slot.location ?? '').toLowerCase().includes(needle) || timeStr.includes(needle);
    });
  }, [slots, searchTerm]);

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
    <div className="plugin-slots min-h-full bg-background">
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
          <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
            {t('nav.slots')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('slots.searchPlaceholder')}
              className="h-9 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={Settings}
            className="h-9 px-3 text-xs"
            onClick={() => openSlotSettings()}
            title={t('slots.settings')}
          >
            {t('slots.settings')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Grid3x3}
            className={cn('h-9 px-3 text-xs', viewMode === 'grid' && 'text-primary')}
            onClick={() => setViewMode('grid')}
          >
            {t('slots.grid')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={List}
            className={cn('h-9 px-3 text-xs', viewMode === 'list' && 'text-primary')}
            onClick={() => setViewMode('list')}
          >
            {t('slots.list')}
          </Button>
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
      </div>

      <div className="px-6 pb-6">
        {filteredSlots.length === 0 ? (
          <Card className="mt-4 border border-border/70 bg-card p-6 text-center text-muted-foreground shadow-sm">
            {searchTerm ? t('slots.noSlotsMatch') : t('slots.noSlotsYet')}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredSlots.map((slot) => (
              <Card
                key={slot.id}
                className="min-h-[140px] cursor-pointer border border-border/70 bg-card p-5 shadow-sm transition-all hover:shadow-md"
                onClick={() => attemptNavigation(() => openSlotForView(slot))}
                role="button"
              >
                <h3 className="font-semibold text-sm">{slot.location || '—'}</h3>
                {slot.category?.trim() && (
                  <div className="mt-1">
                    <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                      {slot.category.trim()}
                    </Badge>
                  </div>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      isSlotTimePast(slot.slot_time) &&
                        'font-medium text-red-600 dark:text-red-400',
                    )}
                  >
                    {formatDateTime(slot.slot_time)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t('common.capacity')} {slot.capacity}{' '}
                  <CapacityAssignedDots
                    capacity={slot.capacity}
                    assignedCount={(slot.mentions?.length ?? 0) + (slot.booked_count ?? 0)}
                  />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mt-4 overflow-hidden border border-border/70 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.location')}</TableHead>
                  <TableHead>{t('common.time')}</TableHead>
                  <TableHead>{t('common.capacity')}</TableHead>
                  <TableHead>
                    {t('common.visible')} / {t('common.notifications')}
                  </TableHead>
                  <TableHead className="text-right">{t('common.updated')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSlots.map((slot) => (
                  <TableRow
                    key={slot.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => attemptNavigation(() => openSlotForView(slot))}
                    role="button"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{slot.location || '—'}</span>
                        {slot.category?.trim() && (
                          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                            {slot.category.trim()}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={
                        isSlotTimePast(slot.slot_time)
                          ? 'text-sm font-medium text-red-600 dark:text-red-400'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {formatDateTime(slot.slot_time)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {slot.capacity}
                        <CapacityAssignedDots
                          capacity={slot.capacity}
                          assignedCount={(slot.mentions?.length ?? 0) + (slot.booked_count ?? 0)}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {slot.visible ? t('common.yes') : t('common.no')} ·{' '}
                      {slot.notifications_enabled ? t('common.on') : t('common.off')}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {slot.updated_at
                        ? new Date(slot.updated_at).toLocaleDateString('sv-SE')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
