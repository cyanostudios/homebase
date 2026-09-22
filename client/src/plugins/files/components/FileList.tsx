import {
  CheckSquare,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Clock,
  HardDrive,
  Image,
  LayoutGrid,
  Menu,
  Plus,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandableIconButton } from '@/components/ui/expandable-icon-button';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { nextListTableSort } from '@/core/list/listViewMode';
import { BulkActionRoundBar, type BulkActionRoundItem } from '@/core/ui/BulkActionRoundBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_AND_SORT_ROW_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
  LIST_FILTER_CHIP_SLOT_CLASS,
  LIST_FILTER_SORT_CLUSTER_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { InlinePanelFormActions } from '@/core/ui/InlinePanelFormActions';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFooterBar } from '@/core/ui/ListFooterBar';
import { useMobileActions, useRegisterMobileSearch } from '@/core/ui/MobileActionsContext';
import { PLUGIN_PAGE_LIST_SHELL_CLASS, PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { ListFilterChipsToggle } from '@/core/ui/ListFilterChipsToggle';
import { usePersistedFiltersVisible } from '@/core/ui/usePersistedFiltersVisible';
import { usePersistedListSearch } from '@/core/ui/usePersistedListSearch';
import { usePersistedToolbarCollapsed } from '@/core/ui/usePersistedToolbarCollapsed';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { useFiles } from '../hooks/useFiles';
import type { FileItem } from '../types/files';
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

import { FileForm } from './FileForm';
import { FileListTable } from './FileListTable';
import { FileSettingsView } from './FileSettingsView';
import { FilesStatisticsView } from './FilesStatisticsView';
import { FileView } from './FileView';

type SortField = FileSortField;
type SortOrder = FileSortOrder;

const FILES_FILTERS_VISIBLE_STORAGE_KEY = 'homebase.files.toolbar.filtersVisible';

const SORT_FIELD_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'name', labelKey: 'files.sort.name' },
  { value: 'updatedAt', labelKey: 'files.sort.updatedAt' },
  { value: 'mimeType', labelKey: 'files.sort.mimeType' },
  { value: 'size', labelKey: 'files.sort.size' },
  { value: 'createdAt', labelKey: 'files.sort.createdAt' },
  { value: 'id', labelKey: 'files.sort.id' },
];

let pendingPreviewFileId: string | null = null;

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
    isFilesPanelOpen,
    panelMode,
    currentFile,
    saveFile,
    closeFilePanel,
    validationErrors,
  } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();

  useMobileActions({
    onAdd: () => attemptNavigation(() => openFilePanel(null)),
    onSettings: () => attemptNavigation(() => openFileSettings()),
  });

  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const { searchTerm, setSearchTerm } = usePersistedListSearch('files');
  useRegisterMobileSearch({
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('files.searchPlaceholder'),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [primarySort, setPrimarySort] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [activeFilters, setActiveFilters] = useState<FileListFilterSelection>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const { toolbarCollapsed, toggleToolbarCollapsed } = usePersistedToolbarCollapsed();
  const { filtersVisible, setFiltersVisible } = usePersistedFiltersVisible(
    FILES_FILTERS_VISIBLE_STORAGE_KEY,
  );
  const restoredPendingFileRef = useRef(false);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const inlineFormRef = useRef<PanelFormHandle | null>(null);
  const [toolbarToggleBox, setToolbarToggleBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const inlineForm =
    showDesktopSplit && isFilesPanelOpen && (panelMode === 'create' || panelMode === 'edit');
  const inlinePanelView =
    showDesktopSplit && isFilesPanelOpen && panelMode === 'view' && currentFile != null;
  const detailFile = inlinePanelView ? currentFile : previewFile;
  const activeListFileId =
    (inlineForm || inlinePanelView) && currentFile != null
      ? currentFile.id
      : (previewFile?.id ?? null);

  const updateToolbarToggleBox = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    setToolbarToggleBox({
      top: typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    updateToolbarToggleBox();
    window.addEventListener('resize', updateToolbarToggleBox);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', updateToolbarToggleBox, { passive: true });
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateToolbarToggleBox) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', updateToolbarToggleBox);
      scrollParent?.removeEventListener('scroll', updateToolbarToggleBox);
      ro?.disconnect();
    };
  }, [updateToolbarToggleBox]);

  useEffect(() => {
    if (restoredPendingFileRef.current || !pendingPreviewFileId) {
      return;
    }
    const restored = files.find((file) => String(file.id) === pendingPreviewFileId);
    if (restored) {
      setPreviewFile(restored);
      restoredPendingFileRef.current = true;
      pendingPreviewFileId = null;
    }
  }, [files]);

  const handlePrimarySortChange = (field: SortField) => {
    setPrimarySort(field);
    setSortOrder(isFileAscDefaultField(field) ? 'asc' : 'desc');
  };

  const handleTableSort = useCallback(
    (field: SortField) => {
      const next = nextListTableSort(primarySort, sortOrder, field, isFileAscDefaultField);
      setPrimarySort(next.field);
      setSortOrder(next.order);
    },
    [primarySort, sortOrder],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = files.filter((item) => fileMatchesListFilters(item, activeFilters));

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((item) => {
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
      images: files.filter((f) => fileIsImage(f)).length,
      withSize: files.filter((f) => fileHasSize(f)).length,
      updated7d: files.filter((f) => fileIsUpdatedWithinDays(f, 7)).length,
    }),
    [files],
  );

  const isFilterActive = (filter: FileListFilter) => activeFilters.includes(filter);
  const toggleFilter = (filter: FileListFilter) => {
    setActiveFilters((prev) => toggleFileListFilter(prev, filter));
  };

  useEffect(() => {
    if (!previewFile) {
      return;
    }
    const next = files.find((file) => String(file.id) === String(previewFile.id));
    if (!next) {
      setPreviewFile(null);
      return;
    }
    if (next !== previewFile) {
      setPreviewFile(next);
    }
  }, [files, previewFile]);

  useEffect(() => {
    if (!showDesktopSplit || !isFilesPanelOpen) {
      return;
    }
    if ((panelMode === 'edit' || panelMode === 'view') && currentFile) {
      setPreviewFile(currentFile);
    }
  }, [showDesktopSplit, isFilesPanelOpen, panelMode, currentFile]);

  const visibleIds = useMemo(() => filteredAndSorted.map((f) => String(f.id)), [filteredAndSorted]);

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

  const onToggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedFileIds.filter((id) => !set.has(id));
      selectAllFiles(remaining);
    } else {
      selectAllFiles(Array.from(new Set([...selectedFileIds, ...visibleIds])));
    }
  }, [allVisibleSelected, visibleIds, selectedFileIds, selectAllFiles]);

  const handleBulkDelete = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds);
      setShowBulkDeleteModal(false);
    } catch (err: unknown) {
      console.error('Bulk delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenForView = (item: FileItem) => {
    pendingPreviewFileId = String(item.id);
    attemptNavigation(() => openFileForView(item));
  };

  const handleEnterSelectionMode = () => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = () => {
    clearFileSelection();
    setSelectionMode(false);
  };

  const handleRowActivate = (item: FileItem) => {
    if (isCompactViewport) {
      handleOpenForView(item);
      return;
    }
    if (selectionMode) {
      toggleFileSelected(String(item.id));
      return;
    }
    if (
      isFilesPanelOpen &&
      (panelMode === 'create' || panelMode === 'edit' || panelMode === 'view')
    ) {
      attemptNavigation(() => {
        closeFilePanel();
        setPreviewFile(item);
      });
      return;
    }
    setPreviewFile((current) => (current && String(current.id) === String(item.id) ? null : item));
  };

  const handleInlineFormSave = useCallback(async () => {
    await inlineFormRef.current?.submit();
  }, []);

  const handleInlineFormClose = useCallback(() => {
    if (inlineFormRef.current) {
      inlineFormRef.current.cancel();
      return;
    }
    closeFilePanel();
  }, [closeFilePanel]);

  const handleInlineFormOnSave = useCallback(
    async (data: Parameters<typeof saveFile>[0]) => {
      const ok = await saveFile(data);
      return ok;
    },
    [saveFile],
  );

  const inlineFormHasBlockingErrors = validationErrors.some(
    (e) => !String(e?.message || '').includes('Warning'),
  );

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

  const headerDropdownTriggerClass =
    'gap-1.5 border-0 bg-primary/10 px-3.5 text-sm font-extrabold text-primary shadow-none hover:bg-primary hover:text-primary-foreground';

  const headerDropdownTriggerDangerClass =
    'gap-1.5 border-0 bg-red-600/10 px-3.5 text-sm font-extrabold text-red-700 shadow-none hover:bg-red-600 hover:text-white dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white';

  const renderFilterChips = () => {
    const chips: Array<{
      key: string;
      active: boolean;
      icon: typeof LayoutGrid;
      label: string;
      count: number;
      onClick: () => void;
    }> = [
      {
        key: 'all',
        active: activeFilters.length === 0,
        icon: LayoutGrid,
        label: t('files.filterTotal'),
        count: stats.total,
        onClick: () => setActiveFilters([]),
      },
      {
        key: 'images',
        active: isFilterActive('images'),
        icon: Image,
        label: t('files.filterImages'),
        count: stats.images,
        onClick: () => toggleFilter('images'),
      },
      {
        key: 'withSize',
        active: isFilterActive('withSize'),
        icon: HardDrive,
        label: t('files.filterWithSize'),
        count: stats.withSize,
        onClick: () => toggleFilter('withSize'),
      },
      {
        key: 'updated7d',
        active: isFilterActive('updated7d'),
        icon: Clock,
        label: t('files.filterUpdated7d'),
        count: stats.updated7d,
        onClick: () => toggleFilter('updated7d'),
      },
    ];

    return (
      <div className={cn(LIST_FILTER_CHIP_ROW_CLASS, LIST_FILTER_CHIP_SLOT_CLASS)}>
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={chip.onClick}
              className={cn(chip.active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>
                {chip.label} <span className="tabular-nums font-semibold">({chip.count})</span>
              </span>
            </Button>
          );
        })}
      </div>
    );
  };

  const primarySortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === primarySort)?.labelKey ??
    SORT_FIELD_OPTIONS[0].labelKey;

  const renderSortDropdown = (triggerClassName: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('files.sortLabel', { defaultValue: 'Sort' })}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{t('files.sortLabel', { defaultValue: 'Sort' })}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[14rem] rounded-xl border-border/50 shadow-xl"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t(primarySortLabel)}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={primarySort}
          onValueChange={(value) => handlePrimarySortChange(value as SortField)}
        >
          {SORT_FIELD_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-md text-xs"
              onSelect={(event) => event.preventDefault()}
            >
              {t(option.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {sortOrder === 'asc'
            ? t('files.sortAsc', { defaultValue: 'Ascending' })
            : t('files.sortDesc', { defaultValue: 'Descending' })}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <DropdownMenuRadioItem
            value="asc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowUp className="mr-2 h-3.5 w-3.5" />
            {t('files.sortAsc', { defaultValue: 'Ascending' })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="desc"
            className="rounded-md text-xs"
            onSelect={(event) => event.preventDefault()}
          >
            <ArrowDown className="mr-2 h-3.5 w-3.5" />
            {t('files.sortDesc', { defaultValue: 'Descending' })}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderBulkActionBar = (className?: string) =>
    selectionMode ? (
      <BulkActionRoundBar
        selectedCount={selectedCount}
        actions={bulkRoundActions}
        size="xs"
        className={cn('gap-1.5', className)}
      />
    ) : null;

  const renderSelectControls = (triggerClassName: string) => {
    if (filteredAndSorted.length === 0) {
      return null;
    }

    if (!selectionMode) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(headerDropdownTriggerClass, triggerClassName)}
          aria-label={t('common.select')}
          aria-pressed={false}
          onClick={handleEnterSelectionMode}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>{t('common.select')}</span>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(headerDropdownTriggerDangerClass, triggerClassName)}
        aria-label={t('common.clear')}
        aria-pressed={true}
        onClick={handleExitSelectionMode}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span>{t('common.clear')}</span>
      </Button>
    );
  };

  if (filesContentView === 'settings') {
    return (
      <div className="plugin-files min-h-full bg-background">
        <div className="px-6 py-4">
          <FileSettingsView onClose={closeFileSettingsView} />
        </div>
      </div>
    );
  }

  const toolbarEdgeToggle =
    typeof document !== 'undefined' && toolbarToggleBox
      ? createPortal(
          <div
            className="pointer-events-none fixed z-40 hidden justify-center md:flex"
            style={{
              top: toolbarToggleBox.top,
              left: toolbarToggleBox.left,
              width: toolbarToggleBox.width,
            }}
          >
            <div className="pointer-events-auto">
              <RoundIconLabelButton
                icon={Menu}
                label={toolbarCollapsed ? t('files.expandToolbar') : t('files.collapseToolbar')}
                variant={toolbarCollapsed ? 'primary' : 'secondary'}
                size="xs"
                expandOnHover={false}
                className={
                  toolbarCollapsed
                    ? undefined
                    : 'bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-primary dark:hover:bg-primary dark:hover:text-primary-foreground'
                }
                aria-expanded={!toolbarCollapsed}
                aria-controls="files-mail-toolbar"
                onClick={toggleToolbarCollapsed}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

  const detailColumnOpen = Boolean(detailFile || inlineForm);

  return (
    <>
      {toolbarEdgeToggle}
      <div
        ref={pageShellRef}
        className={cn(
          'plugin-files flex min-h-0 flex-1 flex-col',
          PLUGIN_PAGE_LIST_SHELL_CLASS,
          showDesktopSplit
            ? 'overflow-hidden px-3 pb-3 pt-3 md:px-3 md:pb-3 md:pt-3'
            : 'overflow-y-auto md:pt-3',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showDesktopSplit && toolbarCollapsed ? 'gap-0' : 'gap-3',
          )}
        >
          <div className="relative hidden shrink-0 md:block">
            <div
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                toolbarCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
              )}
              aria-hidden={toolbarCollapsed}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  id="files-mail-toolbar"
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3',
                    toolbarCollapsed && 'pointer-events-none',
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.files')}</h2>
                    <ExpandableIconButton
                      icon={Settings}
                      label={t('common.settings')}
                      variant="soft"
                      onClick={() => attemptNavigation(() => openFileSettings())}
                    />
                    {renderSortDropdown('h-11 rounded-full')}
                    <ListFilterChipsToggle
                      visible={filtersVisible}
                      onVisibleChange={setFiltersVisible}
                      className="h-11 rounded-full"
                    />
                    {renderSelectControls('h-11 rounded-full')}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoundExpandableSearch
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder={t('files.searchPlaceholder')}
                    />
                    <ExpandableIconButton
                      icon={Plus}
                      label={t('files.addFile')}
                      variant={detailColumnOpen ? 'soft' : 'primary'}
                      onClick={() => attemptNavigation(() => openFilePanel(null))}
                    />
                  </div>
                </div>
                {filtersVisible ? (
                  <div
                    className={cn(
                      LIST_FILTER_AND_SORT_ROW_CLASS,
                      'pt-2',
                      toolbarCollapsed && 'pointer-events-none',
                    )}
                  >
                    {renderFilterChips()}
                  </div>
                ) : null}
                {renderBulkActionBar('py-3')}
              </div>
            </div>
          </div>

          <div className={cn(LIST_FILTER_AND_SORT_ROW_CLASS, 'shrink-0 md:hidden')}>
            {filtersVisible ? renderFilterChips() : null}
            <div className={LIST_FILTER_SORT_CLUSTER_CLASS}>
              <ListFilterChipsToggle
                visible={filtersVisible}
                onVisibleChange={setFiltersVisible}
                className="h-7 rounded-md"
              />
              {renderSortDropdown('h-7 rounded-md')}
            </div>
          </div>

          {selectionMode ? (
            <div className="shrink-0 py-3 md:hidden">{renderBulkActionBar()}</div>
          ) : null}

          <BulkDeleteModal
            isOpen={showBulkDeleteModal}
            onClose={() => setShowBulkDeleteModal(false)}
            onConfirm={handleBulkDelete}
            itemCount={selectedCount}
            itemLabel="files"
            isLoading={deleting}
            warningMessage={t('files.bulkDeleteWarning')}
          />

          <div
            className={cn(
              'grid min-h-0 min-w-0 gap-2',
              showDesktopSplit
                ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
                : 'grid-cols-1 items-start',
            )}
          >
            <div
              className={cn(
                'min-w-0',
                showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
              )}
            >
              <div className="flex min-w-0 flex-col gap-3">
                {filteredAndSorted.length === 0 ? (
                  <ListEmptyState
                    message={searchTerm ? t('files.noMatch') : t('files.noYet')}
                    createLabel={!searchTerm ? t('files.addFile') : undefined}
                    onCreate={
                      !searchTerm ? () => attemptNavigation(() => openFilePanel(null)) : undefined
                    }
                  />
                ) : (
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
                    onHeaderCheckboxChange={onToggleAllVisible}
                    selectionEnabled={selectionMode}
                    activeFileId={activeListFileId}
                  />
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

            {showDesktopSplit ? (
              <aside
                className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={t('files.quickContext.title', { defaultValue: 'File details' })}
                aria-live="polite"
              >
                {inlineForm ? (
                  <FileForm
                    ref={inlineFormRef}
                    currentItem={currentFile}
                    onSave={handleInlineFormOnSave}
                    onCancel={closeFilePanel}
                    stacked
                    headerTrailing={
                      <InlinePanelFormActions
                        mode={panelMode === 'edit' ? 'edit' : 'create'}
                        hasBlockingErrors={inlineFormHasBlockingErrors}
                        onClose={handleInlineFormClose}
                        onSave={() => {
                          void handleInlineFormSave();
                        }}
                        t={t}
                        className="flex shrink-0 items-center gap-1"
                      />
                    }
                  />
                ) : detailFile ? (
                  <FileView file={detailFile} stacked />
                ) : (
                  <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'p-4 md:p-6')}>
                    <FilesStatisticsView />
                  </Card>
                )}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};
