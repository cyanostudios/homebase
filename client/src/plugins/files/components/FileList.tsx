import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  Clock,
  HardDrive,
  Image,
  LayoutGrid,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import {
  useEffectiveCardColumnCount,
  useEffectiveColumnCount,
  useIsEffectiveTableView,
} from '@/core/list/effectiveListViewMode';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListColumnLayoutToggle } from '@/core/ui/ListColumnLayoutToggle';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import {
  PLUGIN_PAGE_HEADER_ACTIONS_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
  PLUGIN_PAGE_TITLE_ROW_CLASS,
} from '@/core/ui/pluginPageStyles';
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
  fileHasSize,
  fileIsImage,
  fileIsUpdatedWithinDays,
  fileMatchesListFilters,
  toggleFileListFilter,
  type FileListFilter,
  type FileListFilterSelection,
} from '../utils/fileListFilter';
import {
  compareFilesByField,
  isFileAscDefaultField,
  type FileSortField,
  type FileSortOrder,
} from '../utils/fileListSort';
import {
  getInitialFileListViewMode,
  isFileListViewMode,
  persistFileListViewModeSession,
  resolveFileListViewMode,
  type FileListViewMode,
} from '../utils/fileListViewMode';

import { FileListItem } from './FileListItem';
import { FileListTable } from './FileListTable';
import { FileSettingsView } from './FileSettingsView';

type SortField = FileSortField;
type SortOrder = FileSortOrder;

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'name', label: 'Name' },
  { value: 'mimeType', label: 'Type' },
  { value: 'size', label: 'Size' },
  { value: 'createdAt', label: 'Created' },
  { value: 'id', label: 'ID' },
];

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

  useMobileActions({
    onAdd: () => attemptNavigation(() => openFilePanel(null)),
    onSettings: () => openFileSettings(),
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);

  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('files.searchPlaceholder'),
  });

  const [primarySort, setPrimarySort] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [columnCount, setColumnCountState] = useState<FileColumnCount>(getInitialFileColumnCount);
  const [listViewMode, setListViewModeState] = useState<FileListViewMode>(
    getInitialFileListViewMode,
  );
  const [activeFilters, setActiveFilters] = useState<FileListFilterSelection>([]);
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
        const hasColumnPref = settingsHasFileColumnPreference(settings);
        const hasListViewPref = isFileListViewMode(settings?.listViewMode);
        if (!hasColumnPref && !hasListViewPref) {
          return;
        }
        if (hasColumnPref) {
          const resolved = resolveFileColumnCount(settings);
          const next = (resolved === 1 || resolved === 2 ? 3 : resolved) as FileColumnCount;
          setColumnCountState(next);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(FILES_COLUMN_COUNT_STORAGE_KEY, String(next));
          }
          if (next !== resolved) {
            updateSettings(FILES_SETTINGS_KEY, { columnCount: next }).catch(() => {});
          }
        }
        if (hasListViewPref) {
          const nextView = resolveFileListViewMode(settings);
          setListViewModeState(nextView);
          persistFileListViewModeSession(nextView);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setColumnCount = useCallback(
    (_count: FileColumnCount) => {
      const next = 3 as FileColumnCount;
      setColumnCountState(next);
      setListViewModeState('cards');
      persistFileListViewModeSession('cards');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(FILES_COLUMN_COUNT_STORAGE_KEY, String(next));
      }
      updateSettings(FILES_SETTINGS_KEY, { columnCount: next, listViewMode: 'cards' }).catch(
        () => {},
      );
    },
    [updateSettings],
  );

  const setListViewMode = useCallback(
    (mode: FileListViewMode) => {
      setListViewModeState(mode);
      persistFileListViewModeSession(mode);
      updateSettings(FILES_SETTINGS_KEY, { listViewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isFileAscDefaultField(field) ? 'asc' : 'desc');
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isFileAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const isTableView = useIsEffectiveTableView(listViewMode);
  const effectiveColumnCount = useEffectiveColumnCount(columnCount);
  const effectiveCardColumnCount = useEffectiveCardColumnCount(columnCount);

  const filteredAndSorted = useMemo(() => {
    const byFilter = files.filter((item: any) => fileMatchesListFilters(item, activeFilters));

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
  }, [files, searchTerm, primarySort, sortOrder, activeFilters]);

  const stats = useMemo(
    () => ({
      total: files.length,
      images: files.filter((f: any) => fileIsImage(f)).length,
      withSize: files.filter((f: any) => fileHasSize(f)).length,
      updated7d: files.filter((f: any) => fileIsUpdatedWithinDays(f, 7)).length,
    }),
    [files],
  );

  const isFilterActive = (filter: FileListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: FileListFilter) => {
    setActiveFilters((prev) => toggleFileListFilter(prev, filter));
  };

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

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearFileSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: any) => {
    if (selectionMode) {
      toggleFileSelected(String(item.id));
      return;
    }
    handleOpenForView(item);
  };

  const bulkRoundActions = useMemo((): BulkActionRoundItem[] => {
    const disabled = selectedCount === 0;
    return [
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        disabled,
        tone: 'destructive',
        onClick: () => setShowBulkDeleteModal(true),
      },
    ];
  }, [selectedCount, t]);

  if (filesContentView === 'settings') {
    return (
      <div className="plugin-files min-h-full bg-background">
        <div className="px-6 py-4">
          <FileSettingsView onClose={closeFileSettingsView} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('plugin-files', PLUGIN_PAGE_LIST_SHELL_CLASS)}>
      <div className={PLUGIN_PAGE_SECTION_GAP_CLASS}>
        <div className="hidden md:block">
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="min-w-0">
                <div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
                  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.files')}</h2>
                  <ExpandableIconButton
                    icon={Settings}
                    label={t('common.settings')}
                    variant="soft"
                    onClick={() => openFileSettings()}
                  />
                  {filteredAndSorted.length > 0 ? (
                    selectionMode ? (
                      <ExpandableIconButton
                        icon={XCircle}
                        label={t('common.clear')}
                        variant="danger"
                        alwaysExpanded
                        onClick={handleExitSelectionMode}
                      />
                    ) : (
                      <ExpandableIconButton
                        icon={CheckSquare}
                        label={t('common.select')}
                        variant="soft"
                        alwaysExpanded
                        onClick={handleEnterSelectionMode}
                      />
                    )
                  ) : null}
                </div>
              </div>
              {selectionMode ? (
                <BulkActionRoundBar
                  selectedCount={selectedCount}
                  actions={bulkRoundActions}
                  className="gap-2"
                />
              ) : null}
            </div>
            <div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
              <RoundExpandableSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={t('files.searchPlaceholder')}
              />
              <ListColumnLayoutToggle
                columnCount={columnCount}
                listViewMode={listViewMode}
                onSelectColumns={setColumnCount}
                onSelectTable={() => setListViewMode('table')}
                columnAriaLabel={(count) => t(`files.columns${count}`)}
                tableAriaLabel={t('common.tableView')}
              />
              <ExpandableIconButton
                icon={Plus}
                label={t('files.addFile')}
                variant="soft"
                alwaysExpanded
                onClick={() => attemptNavigation(() => openFilePanel(null))}
              />
            </div>
          </div>
        </div>

        <div className={LIST_FILTER_AND_SORT_ROW_CLASS}>
          <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilters([])}
              className={cn(
                activeFilters.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>
                Total <span className="tabular-nums font-semibold">({stats.total})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('images')}
              className={cn(
                isFilterActive('images') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Image className="h-3.5 w-3.5" />
              <span>
                Images <span className="tabular-nums font-semibold">({stats.images})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('withSize')}
              className={cn(
                isFilterActive('withSize') ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <HardDrive className="h-3.5 w-3.5" />
              <span>
                With Size <span className="tabular-nums font-semibold">({stats.withSize})</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter('updated7d')}
              className={cn(
                isFilterActive('updated7d')
                  ? LIST_FILTER_CHIP_ACTIVE_CLASS
                  : LIST_FILTER_CHIP_CLASS,
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                Updated 7d <span className="tabular-nums font-semibold">({stats.updated7d})</span>
              </span>
            </Button>
          </div>
          <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
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
          {filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm ? t('files.noMatch') : t('files.noYet')}
              createLabel={!searchTerm ? t('files.addFile') : undefined}
              onCreate={
                !searchTerm ? () => attemptNavigation(() => openFilePanel(null)) : undefined
              }
            />
          ) : isTableView ? (
            <FileListTable
              files={filteredAndSorted}
              primarySort={primarySort}
              sortOrder={sortOrder}
              onSort={handleTableSort}
              isSelected={isSelected}
              onRowClick={handleRowActivate}
              onCheckboxMouseDown={handleRowCheckboxShiftMouseDown}
              onCheckboxChange={onVisibleRowCheckboxChange}
              allVisibleSelected={allVisibleSelected}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              selectionEnabled={selectionMode}
            />
          ) : (
            <div
              className={cn(
                'grid gap-3',
                effectiveColumnCount === 1 && 'grid-cols-1',
                effectiveColumnCount === 2 && 'grid-cols-1 sm:grid-cols-2',
                effectiveColumnCount === 3 && 'grid-cols-1 sm:grid-cols-3',
              )}
            >
              {filteredAndSorted.map((file: any, index: number) => {
                const fileIsSelected = isSelected(String(file.id));
                return (
                  <FileListItem
                    key={file.id}
                    file={file}
                    selected={fileIsSelected}
                    onClick={() => handleRowActivate(file)}
                    columnCount={effectiveCardColumnCount}
                    checkbox={
                      selectionMode ? (
                        <input
                          type="checkbox"
                          checked={fileIsSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onChange={() => onVisibleRowCheckboxChange(String(file.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={fileIsSelected ? 'Unselect file' : 'Select file'}
                        />
                      ) : undefined
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
