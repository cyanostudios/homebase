import { ArrowDown, ArrowUp, Grid3x3, List as ListIcon, Plus, Search, Settings, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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
import { useApp } from '@/core/api/AppContext';
import { formatDate } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';

import { YourItemsSettingsView } from './YourItemsSettingsView';

type SortField = 'title' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

const YOUR_ITEMS_VIEW_MODE_STORAGE_KEY = 'your-items:viewMode';
const YOUR_ITEMS_SETTINGS_KEY = 'your-items';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(YOUR_ITEMS_VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

export const YourItemList: React.FC = () => {
  const { t } = useTranslation();
  const {
    yourItems,
    yourItemsContentView,
    openYourItemsPanel,
    openYourItemForView,
    openYourItemsSettings,
    closeYourItemsSettingsView,
  } = useYourItems();
  const { getSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);

  useEffect(() => {
    let cancelled = false;
    getSettings(YOUR_ITEMS_SETTINGS_KEY)
      .then((settings) => {
        if (cancelled) {
          return;
        }
        const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
        setViewModeState(nextMode);
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(YOUR_ITEMS_VIEW_MODE_STORAGE_KEY, nextMode);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(YOUR_ITEMS_VIEW_MODE_STORAGE_KEY, mode);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = yourItems.filter((item) => {
      if (!needle) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(needle) || String(item.id).toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortField) {
        case 'updatedAt':
          av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          break;
        case 'title':
        default:
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
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
  }, [yourItems, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenForView = (item: YourItem) => {
    attemptNavigation(() => openYourItemForView(item));
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return null;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );
  };

  if (yourItemsContentView === 'settings') {
    return (
      <div className="plugin-your-items min-h-full bg-background">
        <div className="px-6 py-4">
          <YourItemsSettingsView
            inlineTrailing={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={X}
                className="h-9 px-3 text-xs"
                onClick={closeYourItemsSettingsView}
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
    <div className="plugin-your-items min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">Your items</h2>
            <p className="text-sm text-muted-foreground">{yourItems.length} items</p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={Settings}
              className="h-9 px-2.5 text-xs"
              onClick={openYourItemsSettings}
              title={t('common.settings')}
            >
              {t('common.settings')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openYourItemsPanel(null))}
            >
              Add item
            </Button>
          </div>
        </div>

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
              'flex flex-shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title or id..."
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
              <Button
                type="button"
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
                title="Grid view"
              />
              <Button
                type="button"
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
                title="List view"
              />
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSorted.length === 0 ? (
                <p className="col-span-full p-4 text-center text-sm text-muted-foreground">
                  {searchTerm ? 'No items match your search.' : 'No items yet.'}
                </p>
              ) : (
                filteredAndSorted.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer rounded-xl border-0 bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
                    onClick={() => handleOpenForView(item)}
                  >
                    <div className="text-sm font-medium">{item.title || '—'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.updatedAt) || '—'}
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <Table rowBorders={false}>
              <TableHeader>
                <TableRow className="bg-slate-50/90 dark:bg-slate-900/50 hover:bg-slate-50/90 dark:hover:bg-slate-900/50">
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Title</span>
                      <SortIcon field="title" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('updatedAt')}
                  >
                    <div className="flex items-center gap-2">
                      <span>Updated</span>
                      <SortIcon field="updatedAt" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="p-6 text-center text-muted-foreground">
                      {searchTerm
                        ? 'No items match your search.'
                        : 'No items yet. Click "Add item" to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSorted.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50',
                        'focus:bg-plugin-subtle focus:outline-none focus:ring-2 focus:ring-plugin-subtle focus:ring-inset',
                      )}
                      tabIndex={0}
                      data-list-item={JSON.stringify(item)}
                      data-plugin-name="your-items"
                      role="button"
                      aria-label={`Open ${item.title || item.id}`}
                      onClick={() => handleOpenForView(item)}
                    >
                      <TableCell>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.title || '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.id}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.updatedAt) || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};
