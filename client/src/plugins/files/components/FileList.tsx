import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { ListToolbar } from '@/core/ui/ListToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useFiles } from '../hooks/useFiles';
import {
  getInitialFileColumnCount,
  resolveFileColumnCount,
  settingsHasFileColumnPreference,
  FILES_COLUMN_COUNT_STORAGE_KEY,
  FILES_SETTINGS_KEY,
  type FileColumnCount,
} from '../utils/fileColumnCount';
import {
  compareFilesByField,
  isFileStringSortField,
  type FileSortField,
  type FileSortOrder,
} from '../utils/fileListSort';

import { FileListItem } from './FileListItem';
import { FileSettingsView } from './FileSettingsView';

type SortField = FileSortField;
type SortOrder = FileSortOrder;
type FileFilter = 'all' | 'images' | 'withSize' | 'updated7d';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'mimeType', label: 'Type' },
  { value: 'size', label: 'Size' },
  { value: 'createdAt', label: 'Created' },
  { value: 'id', label: 'ID' },
];

const COLUMN_OPTIONS: FileColumnCount[] = [1, 2, 3];

export const FileList: React.FC = () => {
  const { t } = useTranslation();
  const {
    files,
    filesContentView,
    openFileForView,
    openFilePanel,
    openFileSettings,
    closeFileSettingsView,
    selectedFileIds,
    toggleFileSelected,
    mergeIntoFileSelection,
    selectAllFiles,
    clearFileSelection,
    selectedCount,
    isSelected,
    deleteFiles,
  } = useFiles();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<FileColumnCount>(getInitialFileColumnCount);
  const [activeFilter, setActiveFilter] = useState<FileFilter>('all');
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings(FILES_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        // Empty/failed settings must not wipe session selection (list remounts on detail close).
        if (!settingsHasFileColumnPreference(settings)) {
          return;
        }
        const next = resolveFileColumnCount(settings);
        setColumnCountState(next);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(FILES_COLUMN_COUNT_STORAGE_KEY, String(next));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (count: FileColumnCount) => {
      setColumnCountState(count);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(FILES_COLUMN_COUNT_STORAGE_KEY, String(count));
      }
      updateSettings(FILES_SETTINGS_KEY, { columnCount: count }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isFileStringSortField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const filteredAndSorted = useMemo(() => {
    const byFilter = files.filter((item: any) => {
      if (activeFilter === 'images') {
        return String(item?.mimeType || '').startsWith('image/');
      }
      if (activeFilter === 'withSize') {
        return typeof item?.size === 'number' && item.size > 0;
      }
      if (activeFilter === 'updated7d') {
        const date = item?.updatedAt ? new Date(item.updatedAt).getTime() : NaN;
        return Number.isFinite(date) && Date.now() - date <= 7 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((item: any) => {
      if (!needle) {
        return true;
      }
      return (
        String(item?.name ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(item?.id ?? '')
          .toLowerCase()
          .includes(needle) ||
        String(item?.mimeType ?? '')
          .toLowerCase()
          .includes(needle)
      );
    });

    return [...filtered].sort((a, b) => compareFilesByField(a, b, primarySort, sortOrder));
  }, [files, searchTerm, primarySort, sortOrder, activeFilter]);

  const stats = useMemo(
    () => ({
      total: files.length,
      images: files.filter((f: any) => String(f?.mimeType || '').startsWith('image/')).length,
      withSize: files.filter((f: any) => typeof f?.size === 'number' && f.size > 0).length,
      updated7d: files.filter((f: any) => {
        const date = f?.updatedAt ? new Date(f.updatedAt).getTime() : NaN;
        return Number.isFinite(date) && Date.now() - date <= 7 * 24 * 60 * 60 * 1000;
      }).length,
    }),
    [files],
  );

  const visibleIds = useMemo(
    () => filteredAndSorted.map((f: any) => String(f.id)),
    [filteredAndSorted],
  );

  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => isSelected(id)),
    [visibleIds, isSelected],
  );

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoFileSelection,
      toggleOne: toggleFileSelected,
    });

  const handleHeaderCheckboxChange = () => {
    if (allVisibleSelected) {
      clearFileSelection();
    } else {
      selectAllFiles(visibleIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds);
      setShowBulkDeleteModal(false);
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: any) => attemptNavigation(() => openFileForView(item));

  if (filesContentView === 'settings') {
    return (
      <div className="plugin-files min-h-full bg-background">
        <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {t('files.settingsTitle')}
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={X}
            className="h-9 px-3 text-xs"
            onClick={closeFileSettingsView}
          >
            {t('common.close')}
          </Button>
        </div>
        <div className="px-6 pb-6">
          <FileSettingsView />
        </div>
      </div>
    );
  }

  return (
    <div className="plugin-files min-h-full bg-background px-6 py-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.files')}</h2>
            <p className="text-sm text-muted-foreground">{t('files.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={() => openFileSettings()}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openFilePanel(null))}
            >
              {t('files.addFile')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label="Images"
            value={stats.images}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'images'}
            onClick={() => setActiveFilter('images')}
          />
          <ListFilterStatCard
            label="With Size"
            value={stats.withSize}
            dotClassName="bg-amber-500"
            active={activeFilter === 'withSize'}
            onClick={() => setActiveFilter('withSize')}
          />
          <ListFilterStatCard
            label="Updated 7d"
            value={stats.updated7d}
            dotClassName="bg-violet-500"
            active={activeFilter === 'updated7d'}
            onClick={() => setActiveFilter('updated7d')}
          />
        </div>

        <BulkDeleteModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={handleBulkDelete}
          itemCount={selectedCount}
          itemLabel="files"
          isLoading={deleting}
          warningMessage={t('files.bulkDeleteWarning')}
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
                onClick={handleHeaderCheckboxChange}
              >
                Select all
              </Button>
            }
            search={
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('files.searchPlaceholder')}
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
                      {SORT_FIELD_OPTIONS.map((option) => (
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
                <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
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
                      aria-label={t(`files.columns${count}`)}
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
                  onClick={clearFileSelection}
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
              {searchTerm ? t('files.noMatch') : t('files.noYet')}
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
              {filteredAndSorted.map((file: any, index: number) => {
                const fileIsSelected = isSelected(String(file.id));
                return (
                  <FileListItem
                    key={file.id}
                    file={file}
                    selected={fileIsSelected}
                    onClick={() => handleOpenForView(file)}
                    columnCount={columnCount}
                    checkbox={
                      <input
                        type="checkbox"
                        checked={fileIsSelected}
                        onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                        onChange={() => onVisibleRowCheckboxChange(String(file.id))}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer"
                        aria-label={fileIsSelected ? 'Unselect file' : 'Select file'}
                      />
                    }
                  />
                );
              })}
            </div>
          )}

          <ListFooterBar
            meta={
              <>
                Showing {filteredAndSorted.length} of {files.length} Files
              </>
            }
          />
        </div>
      </div>
    </div>
  );
};
