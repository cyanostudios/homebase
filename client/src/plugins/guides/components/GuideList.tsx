import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useGuides } from '../hooks/useGuides';
import { type Guide } from '../types/guides';
import {
  getInitialGuideColumnCount,
  GUIDES_COLUMN_COUNT_STORAGE_KEY,
  type GuideColumnCount,
} from '../utils/guideColumnCount';
import {
  compareGuidesByField,
  isGuideAscDefaultField,
  type GuideSortField,
  type GuideSortOrder,
} from '../utils/guideListSort';

import { BulkStatusDialog } from './BulkStatusDialog';
import { GuideListItem } from './GuideListItem';
import { GuideSettingsView, type GuideSettingsCategory } from './GuideSettingsView';

type SortField = GuideSortField;
type SortOrder = GuideSortOrder;
type GuideListFilter = 'all' | 'draft' | 'active' | 'audioReady';

const COLUMN_OPTIONS: GuideColumnCount[] = [1, 2, 3];

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
    refreshGuides,
    guidesContentView,
    openGuideSettings,
    closeGuideSettingsView,
  } = useGuides();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<SortField>('displayName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [columnCount, setColumnCountState] = useState<GuideColumnCount>(getInitialGuideColumnCount);
  const [activeFilter, setActiveFilter] = useState<GuideListFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<GuideSettingsCategory>('production');

  const setColumnCount = useCallback((count: GuideColumnCount) => {
    setColumnCountState(count);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(GUIDES_COLUMN_COUNT_STORAGE_KEY, String(count));
    }
  }, []);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isGuideAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortFieldOptions = useMemo(
    (): { value: SortField; label: string }[] => [
      { value: 'displayName', label: t('guides.colName') },
      { value: 'id', label: t('guides.colId') },
      { value: 'updatedAt', label: t('guides.colUpdated') },
      { value: 'createdAt', label: t('guides.colCreated') },
      { value: 'lifecycleStatus', label: t('guides.colStatus') },
      { value: 'languages', label: t('guides.colLanguages') },
    ],
    [t],
  );

  const selectedGuides = useMemo(() => {
    const idSet = new Set(selectedGuideIds.map(String));
    return guides.filter((guide) => idSet.has(String(guide.id)));
  }, [guides, selectedGuideIds]);

  const stats = useMemo(() => {
    let draft = 0;
    let active = 0;
    let audioReady = 0;
    for (const guide of guides) {
      if (guide.lifecycleStatus === 'draft') draft += 1;
      else if (guide.lifecycleStatus === 'active') active += 1;
      if (guide.hasReadyAudio) audioReady += 1;
    }
    return { total: guides.length, draft, active, audioReady };
  }, [guides]);

  const filteredAndSorted = useMemo(() => {
    const byFilter = guides.filter((guide) => {
      if (activeFilter === 'draft') return guide.lifecycleStatus === 'draft';
      if (activeFilter === 'active') return guide.lifecycleStatus === 'active';
      if (activeFilter === 'audioReady') return Boolean(guide.hasReadyAudio);
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = needle
      ? byFilter.filter((guide) => {
          return (
            guide.displayName.toLowerCase().includes(needle) ||
            String(guide.id).toLowerCase().includes(needle) ||
            (guide.geographicReference ?? '').toLowerCase().includes(needle)
          );
        })
      : byFilter;

    return [...filtered].sort((a, b) => compareGuidesByField(a, b, primarySort, sortOrder));
  }, [guides, searchTerm, primarySort, sortOrder, activeFilter]);

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

  const handleOpenForView = (guide: Guide) => {
    attemptNavigation(() => openGuideForView(guide));
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

  if (guidesContentView === 'settings') {
    return (
      <div className="plugin-guides min-h-full bg-background">
        <div className="px-6 py-4">
          <GuideSettingsView
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
                onClick={closeGuideSettingsView}
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
    <div className="plugin-guides min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('guides.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('guides.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openGuideSettings()}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
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

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label={t('guides.stats.total')}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label={t('guides.stats.draft')}
            value={stats.draft}
            dotClassName="bg-slate-500"
            active={activeFilter === 'draft'}
            onClick={() => setActiveFilter('draft')}
          />
          <ListFilterStatCard
            label={t('guides.stats.active')}
            value={stats.active}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'active'}
            onClick={() => setActiveFilter('active')}
          />
          <ListFilterStatCard
            label={t('guides.stats.audioReady')}
            value={stats.audioReady}
            dotClassName="bg-green-500"
            active={activeFilter === 'audioReady'}
            onClick={() => setActiveFilter('audioReady')}
          />
        </div>

        <BulkStatusDialog
          isOpen={showBulkStatusDialog}
          onClose={() => setShowBulkStatusDialog(false)}
          selectedGuides={selectedGuides}
          onSuccess={async () => {
            await refreshGuides();
            clearGuideSelection();
          }}
        />
        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="places"
          isLoading={deleting}
        />

        <div className="flex flex-col gap-3">
          <ListToolbar
            selectedCount={selectedCount}
            showSelectAll={filteredAndSorted.length > 0}
            selectAll={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                icon={CheckSquare}
                onClick={onToggleAllVisible}
              >
                {t('common.selectAll')}
              </Button>
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('guides.searchPlaceholder', { count: guides.length })}
                  className="h-8 bg-background pl-9 text-xs"
                />
              </div>
            }
            trailing={
              <>
                <div className="mr-1 flex items-center gap-1">
                  <Select
                    value={primarySort}
                    onValueChange={(value) => handlePrimarySortChange(value as SortField)}
                  >
                    <SelectTrigger
                      className="h-7 w-[140px] rounded-md border-border/30 bg-background px-2 text-xs shadow-none"
                      aria-label="Sort by"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="item-aligned"
                      className="rounded-xl border-border/50 shadow-xl"
                    >
                      {sortFieldOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="rounded-md text-xs"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 px-0 text-xs"
                    onClick={toggleSortOrder}
                    aria-label={sortOrder === 'asc' ? 'Sort descending' : 'Sort ascending'}
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div
                  className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5"
                  role="group"
                  aria-label={t('guides.columnsLabel')}
                >
                  {COLUMN_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-7 min-w-7 rounded-[6px] px-2 text-xs',
                        columnCount === count
                          ? 'bg-background text-foreground shadow-sm hover:bg-background'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setColumnCount(count)}
                      aria-label={t(`guides.columns${count}`)}
                      aria-pressed={columnCount === count}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </>
            }
            bulkActions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XCircle}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                  onClick={clearGuideSelection}
                  type="button"
                >
                  {t('common.clearSelection')}
                </Button>
                <span className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                  {t('bulk.selected', { count: selectedCount })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={SlidersHorizontal}
                  onClick={() => setShowBulkStatusDialog(true)}
                  className="h-9 px-3 text-xs text-foreground underline decoration-border hover:bg-primary/10 hover:text-primary hover:decoration-primary"
                >
                  {t('guides.bulkStatusAction')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="h-9 px-3 text-xs text-red-600 underline decoration-red-600/50 hover:bg-red-50 hover:text-red-700 hover:decoration-red-700 dark:text-red-400 dark:decoration-red-400/50 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                >
                  {t('common.delete')}
                </Button>
              </>
            }
          />

          {filteredAndSorted.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-muted-foreground shadow-sm dark:bg-slate-950">
              {searchTerm || activeFilter !== 'all' ? t('guides.noMatch') : t('guides.noYet')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                columnCount === 1 && 'grid-cols-1',
                columnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                columnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((guide, index) => {
                const guideIsSelected = isSelected(guide.id);
                return (
                  <GuideListItem
                    key={guide.id}
                    guide={guide}
                    selected={guideIsSelected}
                    columnCount={columnCount}
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
          )}

          <ListFooterBar
            meta={t('guides.showingCount', {
              shown: filteredAndSorted.length,
              total: guides.length,
            })}
          />
        </div>
      </div>
    </div>
  );
};
