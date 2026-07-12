import { ArrowDown, ArrowUp, Grid3x3, List, Plus, Search, Trash2 } from 'lucide-react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useGuides } from '../hooks/useGuides';
import { type Guide, GUIDE_LIFECYCLE_COLORS } from '../types/guides';

import { GuideCard } from './GuideCard';

type SortField = 'id' | 'displayName' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const GUIDES_VIEW_MODE_STORAGE_KEY = 'guides:viewMode';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(GUIDES_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

export const GuideList: React.FC = () => {
  const { t } = useTranslation();
  const {
    guides,
    openGuidePanel,
    openGuideForView,
    deleteGuides,
    selectedGuideIds,
    toggleGuideSelected,
    mergeIntoGuideSelection,
    selectAllGuides,
    clearGuideSelection,
    selectedCount,
    isSelected,
  } = useGuides();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('displayName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(GUIDES_VIEW_MODE_STORAGE_KEY, mode);
    }
  }, []);

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = guides.filter((guide) => {
      if (!needle) return true;
      return (
        guide.displayName.toLowerCase().includes(needle) ||
        String(guide.id).toLowerCase().includes(needle) ||
        (guide.geographicReference ?? '').toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'updatedAt') {
        av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      } else if (sortField === 'id') {
        av = Number(a.id) || 0;
        bv = Number(b.id) || 0;
      } else {
        av = a.displayName.toLowerCase();
        bv = b.displayName.toLowerCase();
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const res = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? res : -res;
    });
  }, [guides, searchTerm, sortField, sortOrder]);

  const visibleGuideIds = useMemo(
    () => filteredAndSorted.map((guide) => String(guide.id)),
    [filteredAndSorted],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleGuideIds,
      mergeIntoSelection: mergeIntoGuideSelection,
      toggleOne: toggleGuideSelected,
    });

  const allVisibleSelected = useMemo(
    () => visibleGuideIds.length > 0 && visibleGuideIds.every((id) => isSelected(id)),
    [visibleGuideIds, isSelected],
  );

  const someVisibleSelected = useMemo(
    () => visibleGuideIds.some((id) => isSelected(id)),
    [visibleGuideIds, isSelected],
  );

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleGuideIds);
      const remaining = selectedGuideIds.filter((id) => !set.has(id));
      selectAllGuides(remaining);
    } else {
      const union = Array.from(new Set([...selectedGuideIds, ...visibleGuideIds]));
      selectAllGuides(union);
    }
  }, [allVisibleSelected, visibleGuideIds, selectedGuideIds, selectAllGuides]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenForView = (guide: Guide) => {
    attemptNavigation(() => openGuideForView(guide));
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, guide: Guide) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenForView(guide);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedGuideIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteGuides(selectedGuideIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );
  };

  return (
    <div className="plugin-guides min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('guides.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('guides.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openGuidePanel(null))}
            >
              {t('guides.addPlace')}
            </Button>
          </div>
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearGuideSelection}
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

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="places"
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
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('guides.searchPlaceholder', { count: guides.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
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
                {searchTerm ? t('guides.noMatch') : t('guides.noYet')}
              </div>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAndSorted.map((guide, index) => {
                const guideIsSelected = isSelected(guide.id);
                return (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    selected={guideIsSelected}
                    onClick={() => handleOpenForView(guide)}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={guideIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(guide.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={
                          guideIsSelected ? t('guides.unselectPlace') : t('guides.selectPlace')
                        }
                      />
                    }
                  />
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
                      className="w-24 cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('guides.colId')}</span>
                        <SortIcon field="id" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('displayName')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('guides.colName')}</span>
                        <SortIcon field="displayName" />
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">{t('guides.colLocation')}</TableHead>
                    <TableHead className="text-xs">{t('guides.colStatus')}</TableHead>
                    <TableHead className="text-xs">{t('guides.colSourceLanguage')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('guides.colUpdated')}</span>
                        <SortIcon field="updatedAt" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((guide, index) => {
                    const guideIsSelected = isSelected(guide.id);
                    return (
                      <TableRow
                        key={guide.id}
                        className={cn(
                          'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80',
                          guideIsSelected && 'bg-plugin-subtle',
                        )}
                        tabIndex={0}
                        data-list-item={JSON.stringify(guide)}
                        data-plugin-name="guides"
                        role="button"
                        aria-label={t('guides.openPlace', { name: guide.displayName })}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                            return;
                          }
                          handleOpenForView(guide);
                        }}
                        onKeyDown={(e) => handleRowKeyDown(e, guide)}
                      >
                        <TableCell className="w-12">
                          <input
                            type="checkbox"
                            checked={guideIsSelected}
                            onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                            onChange={() => onVisibleRowCheckboxChange(guide.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer"
                            aria-label={
                              guideIsSelected ? t('guides.unselectPlace') : t('guides.selectPlace')
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatDisplayNumber('guides', guide.id)}
                        </TableCell>
                        <TableCell className="font-medium">{guide.displayName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {guide.geographicReference || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={GUIDE_LIFECYCLE_COLORS[guide.lifecycleStatus]}>
                            {t(`guides.lifecycle.${guide.lifecycleStatus}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="uppercase text-muted-foreground">
                          {guide.sourceLanguage}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(guide.updatedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
};
