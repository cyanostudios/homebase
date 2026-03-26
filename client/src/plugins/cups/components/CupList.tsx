import {
  ArrowDown,
  ArrowUp,
  Award,
  Grid3x3,
  List,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { cn } from '@/lib/utils';

import { useCups } from '../context/CupsContext';

import { CupSettingsView } from './CupSettingsView';

type SortField = 'name' | 'start_date' | 'region' | 'organizer';
type SortOrder = 'asc' | 'desc';

const HIGHLIGHT_CLASS = 'bg-green-50 dark:bg-green-950/30';

export function CupList() {
  const { t } = useTranslation();
  const {
    cups,
    cupsContentView,
    openCupForView,
    openCupPanel,
    openCupSettings,
    closeCupSettingsView,
    deleteCup,
    selectedCupIds,
    toggleCupSelected,
    selectAllCups,
    clearCupSelection,
    selectedCount,
    isSelected,
    recentlyDuplicatedCupId,
  } = useCups();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('start_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = cups.filter((c) => {
      if (!needle) {
        return true;
      }
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.region ?? '').toLowerCase().includes(needle) ||
        (c.organizer ?? '').toLowerCase().includes(needle) ||
        (c.location ?? '').toLowerCase().includes(needle) ||
        (c.age_groups ?? '').toLowerCase().includes(needle)
      );
    });
    return [...filtered].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'start_date':
          aVal = a.start_date ?? '';
          bVal = b.start_date ?? '';
          break;
        case 'region':
          aVal = (a.region ?? '').toLowerCase();
          bVal = (b.region ?? '').toLowerCase();
          break;
        case 'organizer':
          aVal = (a.organizer ?? '').toLowerCase();
          bVal = (b.organizer ?? '').toLowerCase();
          break;
        default:
          aVal = '';
          bVal = '';
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [cups, searchTerm, sortField, sortOrder]);

  const visibleCupIds = useMemo(() => filteredAndSorted.map((c) => c.id), [filteredAndSorted]);
  const allVisibleSelected = useMemo(
    () => visibleCupIds.length > 0 && visibleCupIds.every((id) => isSelected(id)),
    [visibleCupIds, isSelected],
  );
  const someVisibleSelected = useMemo(
    () => visibleCupIds.some((id) => isSelected(id)),
    [visibleCupIds, isSelected],
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleCupIds);
      const remaining = selectedCupIds.filter((id) => !set.has(id));
      selectAllCups(remaining);
    } else {
      const union = Array.from(new Set([...selectedCupIds, ...visibleCupIds]));
      selectAllCups(union);
    }
  }, [allVisibleSelected, visibleCupIds, selectedCupIds, selectAllCups]);

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await Promise.all(selectedCupIds.map((id) => deleteCup(id)));
      setShowBulkDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  }, [deleteCup, selectedCupIds]);

  const sortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );
  };

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (cupsContentView === 'settings') {
    return (
      <div className="plugin-cups min-h-full bg-background">
        <div className="px-6 py-4">
          <CupSettingsView onBack={closeCupSettingsView} />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-cups min-h-full bg-background">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('nav.cups')}
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('cups.search')}
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
            onClick={openCupSettings}
            title={t('common.settings')}
          >
            {t('common.settings')}
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
            onClick={() => openCupPanel(null)}
          >
            {t('cups.newCup')}
          </Button>
        </div>
      </div>

      <div className="space-y-4 px-6 pb-6">
        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearCupSelection}
            actions={[
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowBulkDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        {/* Empty state */}
        {filteredAndSorted.length === 0 ? (
          <Card className="mt-4 border border-border/70 bg-card p-6 text-center text-muted-foreground shadow-sm">
            {searchTerm ? t('cups.noResults') : t('cups.empty')}
          </Card>
        ) : viewMode === 'grid' ? (
          /* ── Grid view ── */
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAndSorted.map((cup) => {
              const selected = isSelected(cup.id);
              return (
                <Card
                  key={cup.id}
                  className={cn(
                    'relative min-h-[120px] cursor-pointer border border-border/70 bg-card p-5 shadow-sm transition-all',
                    selected
                      ? 'plugin-cups bg-plugin-subtle ring-1 border-plugin-subtle'
                      : 'hover:border-plugin-subtle hover:plugin-cups hover:shadow-md',
                    recentlyDuplicatedCupId === cup.id && HIGHLIGHT_CLASS,
                  )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                      return;
                    }
                    openCupForView(cup);
                  }}
                  role="button"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleCupSelected(cup.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer"
                      aria-label={selected ? t('common.deselect') : t('common.select')}
                    />
                  </div>
                  <h3 className="text-sm font-semibold">{cup.name}</h3>
                  {cup.region && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{cup.region}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {cup.start_date && <span>{cup.start_date}</span>}
                    {cup.organizer && <span>{cup.organizer}</span>}
                    {cup.age_groups && <span>{cup.age_groups}</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* ── List view ── */
          <Card className="mt-4 overflow-hidden border border-border/70 bg-card shadow-sm">
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
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSortClick('name')}
                  >
                    <div className="flex items-center gap-2">
                      <span>{t('cups.name')}</span>
                      {sortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSortClick('region')}
                  >
                    <div className="flex items-center gap-2">
                      <span>{t('cups.region')}</span>
                      {sortIcon('region')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSortClick('start_date')}
                  >
                    <div className="flex items-center gap-2">
                      <span>{t('cups.startDate')}</span>
                      {sortIcon('start_date')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSortClick('organizer')}
                  >
                    <div className="flex items-center gap-2">
                      <span>{t('cups.organizer')}</span>
                      {sortIcon('organizer')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((cup) => (
                  <TableRow
                    key={cup.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      isSelected(cup.id) && 'bg-plugin-subtle',
                      recentlyDuplicatedCupId === cup.id && HIGHLIGHT_CLASS,
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        return;
                      }
                      openCupForView(cup);
                    }}
                    role="button"
                  >
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected(cup.id)}
                        onChange={() => toggleCupSelected(cup.id)}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={isSelected(cup.id) ? t('common.deselect') : t('common.select')}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{cup.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cup.region ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cup.start_date ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cup.organizer ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <BulkDeleteModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="cups"
        isLoading={deleting}
      />
    </div>
  );
}
