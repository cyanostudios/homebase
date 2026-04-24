import {
  File,
  Trash2,
  Grid3x3,
  List as ListIcon,
  ArrowUp,
  ArrowDown,
  Settings,
  X,
  Plus,
  Search,
} from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { useShiftRangeListSelection } from '@/core/hooks/useShiftRangeListSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useFiles } from '../hooks/useFiles';

import { FileSettingsView } from './FileSettingsView';

type SortField = 'name' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';
type FileFilter = 'all' | 'images' | 'withSize' | 'updated7d';

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

function humanSize(bytes?: number | null) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) {
    return File;
  }
  if (mimeType.startsWith('image/')) {
    return File;
  } // Could use Image icon
  if (mimeType.includes('pdf')) {
    return File;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return File;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return File;
  }
  return File;
}

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
    deleteFiles,
  } = useFiles();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeFilter, setActiveFilter] = useState<FileFilter>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const normalized = (it: any) => ({
    id: String(it.id ?? ''),
    name: String(it.name ?? ''),
    mimeType: it.mimeType ? String(it.mimeType) : '',
    size: typeof it.size === 'number' ? it.size : null,
    updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
    url: it.url ? String(it.url) : '',
    raw: it,
  });

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
    const filtered = byFilter.map(normalized).filter((it) => {
      if (!needle) {
        return true;
      }
      return (
        it.name.toLowerCase().includes(needle) ||
        it.id.toLowerCase().includes(needle) ||
        it.mimeType.toLowerCase().includes(needle)
      );
    });

    const cmp = (a: any, b: any) => {
      let av: any;
      let bv: any;
      switch (sortField) {
        case 'updatedAt':
          av = a.updatedAt ? a.updatedAt.getTime() : 0;
          bv = b.updatedAt ? b.updatedAt.getTime() : 0;
          break;
        case 'id':
          av = a.id.toLowerCase();
          bv = b.id.toLowerCase();
          break;
        case 'name':
        default:
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const res = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [files, searchTerm, sortField, sortOrder, activeFilter]);
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

  // Selection helpers
  const visibleIds = useMemo(
    () => filteredAndSorted.map((f: any) => String(f.id)),
    [filteredAndSorted],
  );
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedFileIds.includes(id)),
    [visibleIds, selectedFileIds],
  );
  const someVisibleSelected = useMemo(
    () => visibleIds.some((id) => selectedFileIds.includes(id)),
    [visibleIds, selectedFileIds],
  );
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange } =
    useShiftRangeListSelection({
      orderedVisibleIds: visibleIds,
      mergeIntoSelection: mergeIntoFileSelection,
      toggleOne: toggleFileSelected,
    });

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }
    headerCheckboxRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const onToggleAllVisible = () => {
    if (allVisibleSelected) {
      const set = new Set(visibleIds);
      const remaining = selectedFileIds.filter((id) => !set.has(id));
      selectAllFiles(remaining);
    } else {
      const union = Array.from(new Set([...selectedFileIds, ...visibleIds]));
      selectAllFiles(union);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
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

  const runDeleteFlow = async () => {
    if (selectedFileIds.length === 0) {
      return;
    }
    setDeleting(true);
    try {
      await deleteFiles(selectedFileIds);
      setShowDeleteModal(false);
      // clearFileSelection is called automatically by deleteFiles
    } catch (err: any) {
      console.error('Bulk delete failed:', err);
      // Error is already handled in context
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="plugin-files min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.files')}</h2>
            <p className="text-sm text-muted-foreground">{t('files.listDescription')}</p>
          </div>
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total"
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <StatCard
            label="Images"
            value={stats.images}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'images'}
            onClick={() => setActiveFilter('images')}
          />
          <StatCard
            label="With Size"
            value={stats.withSize}
            dotClassName="bg-amber-500"
            active={activeFilter === 'withSize'}
            onClick={() => setActiveFilter('withSize')}
          />
          <StatCard
            label="Updated 7d"
            value={stats.updated7d}
            dotClassName="bg-violet-500"
            active={activeFilter === 'updated7d'}
            onClick={() => setActiveFilter('updated7d')}
          />
        </div>

        {selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClearSelection={clearFileSelection}
            actions={[
              {
                label: t('common.delete'),
                icon: Trash2,
                onClick: () => setShowDeleteModal(true),
                variant: 'destructive',
              },
            ]}
          />
        )}

        <BulkDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={runDeleteFlow}
          itemCount={selectedCount}
          itemLabel="files"
          isLoading={deleting}
          warningMessage={t('files.bulkDeleteWarning')}
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
                placeholder={t('files.searchPlaceholder')}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon={Settings}
                className="h-8 px-2.5 text-xs"
                onClick={() => openFileSettings()}
                title={t('common.settings')}
              >
                {t('common.settings')}
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
                  icon={ListIcon}
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
          {viewMode === 'grid' ? (
            filteredAndSorted.length === 0 ? (
              <Card className="shadow-none">
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {searchTerm ? t('files.noMatch') : t('files.noYet')}
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-4 px-1 pb-1 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredAndSorted.map((row: any, index: number) => {
                  const isSelected = selectedFileIds.includes(row.id);
                  const FileIcon = getFileIcon(row.mimeType);
                  const isImage = row.mimeType?.startsWith('image/');
                  return (
                    <Card
                      key={row.id}
                      className={cn(
                        'relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
                        isSelected
                          ? 'plugin-files bg-plugin-subtle ring-1 ring-plugin-subtle/50'
                          : 'hover:border-plugin-subtle hover:plugin-files hover:shadow-md',
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
                          return;
                        }
                        e.preventDefault();
                        handleOpenForView(row.raw);
                      }}
                      data-list-item={JSON.stringify(row.raw)}
                      data-plugin-name="files"
                      role="button"
                      aria-label={`Open file ${row.name}`}
                    >
                      <div className="flex items-start justify-between">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer shrink-0"
                          checked={isSelected}
                          onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => onVisibleRowCheckboxChange(row.id)}
                          aria-label={isSelected ? 'Unselect file' : 'Select file'}
                        />
                      </div>
                      <div className="flex min-h-[80px] flex-1 flex-col items-center justify-center text-center">
                        {isImage && row.url ? (
                          <img
                            src={row.url}
                            alt={row.name}
                            className="w-full h-20 object-cover rounded mb-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="mb-2 flex h-20 w-full items-center justify-center rounded bg-muted/30">
                            <FileIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-sm font-medium truncate w-full" title={row.name}>
                          {row.name || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {humanSize(row.size)}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
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
                        aria-label={allVisibleSelected ? 'Unselect all' : 'Select all'}
                        checked={allVisibleSelected}
                        onChange={onToggleAllVisible}
                      />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('files.columnName')}</span>
                        {sortField === 'name' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">{t('files.columnType')}</TableHead>
                    <TableHead className="text-xs">{t('files.columnSize')}</TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('files.columnUpdated')}</span>
                        {sortField === 'updatedAt' &&
                          (sortOrder === 'asc' ? (
                            <ArrowUp className="inline h-3 w-3" />
                          ) : (
                            <ArrowDown className="inline h-3 w-3" />
                          ))}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        {searchTerm ? t('files.noMatch') : t('files.noYet')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSorted.map((row: any, index: number) => {
                      const isSelected = selectedFileIds.includes(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            'cursor-pointer bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80 plugin-files transition-colors',
                            isSelected && 'bg-plugin-subtle',
                          )}
                          tabIndex={0}
                          data-list-item={JSON.stringify(row.raw)}
                          data-plugin-name="files"
                          role="button"
                          aria-label={`Open file ${row.name}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenForView(row.raw);
                          }}
                        >
                          <TableCell className="text-xs" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer"
                              checked={isSelected}
                              onMouseDown={(e) => handleRowCheckboxShiftMouseDown(e, index)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onVisibleRowCheckboxChange(row.id)}
                              aria-label={isSelected ? 'Unselect file' : 'Select file'}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <File className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{row.name || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {row.mimeType || '—'}
                          </TableCell>
                          <TableCell className="text-xs">{humanSize(row.size)}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {row.updatedAt ? row.updatedAt.toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
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
            Showing {filteredAndSorted.length} of {files.length} Files
          </div>
        </Card>
      </div>
    </div>
  );
};
