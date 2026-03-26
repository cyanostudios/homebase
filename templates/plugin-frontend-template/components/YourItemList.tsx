import React, { useState, useMemo, useEffect } from 'react';
import { Plus, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useContentLayout } from '@/core/ui/ContentLayoutContext';
import { ContentToolbar } from '@/core/ui/ContentToolbar';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useYourItems } from '../hooks/useYourItems';
import type { YourItem } from '../types/your-items';

type SortField = 'title' | 'updatedAt' | 'id';
type SortOrder = 'asc' | 'desc';

export const YourItemList: React.FC = () => {
  const {
    yourItems,
    openYourItemsPanel,
    openYourItemForEdit,
    openYourItemForView,
    openYourItemsSettings,
  } = useYourItems();
  const { setHeaderTrailing } = useContentLayout();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const normalized = (it: YourItem) => ({
    id: String(it.id ?? ''),
    title: String(it.title),
    updatedAt: it.updatedAt ? new Date(it.updatedAt) : null,
    raw: it,
  });

  const filteredAndSorted = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    const filtered = yourItems.map(normalized).filter((it) => {
      if (!needle) return true;
      return it.title.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle);
    });

    const cmp = (a: ReturnType<typeof normalized>, b: ReturnType<typeof normalized>) => {
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
        case 'title':
        default:
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
      }
      if (typeof av === 'number' && typeof bv === 'number')
        return sortOrder === 'asc' ? av - bv : bv - av;
      const res = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'asc' ? res : -res;
    };

    return filtered.sort(cmp);
  }, [yourItems, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Toolbar: same pattern as Files, Contacts, Mail (see §6 PLUGIN_DEVELOPMENT_STANDARDS_V2.md)
  useEffect(() => {
    setHeaderTrailing(
      <ContentToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by title or id..."
        rightActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Settings}
              onClick={() => openYourItemsSettings()}
              className="h-7 text-[10px] px-2"
              title="Plugin settings"
            >
              Settings
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => attemptNavigation(() => openYourItemsPanel(null))}
              className="h-7 text-[10px] px-2"
            >
              Add Item
            </Button>
          </div>
        }
      />,
    );
    return () => setHeaderTrailing(null);
  }, [
    searchTerm,
    setHeaderTrailing,
    openYourItemsSettings,
    openYourItemsPanel,
    attemptNavigation,
  ]);

  const handleOpenForView = (item: any) => attemptNavigation(() => openYourItemForView(item));

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline" />
    ) : (
      <ChevronDown className="h-3 w-3 inline" />
    );
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-none plugin-your-items">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-2">
                  <span>Title</span>
                  <SortIcon field="title" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 select-none"
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
                    : 'No items yet. Click "Add Item" to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((it) => (
                <TableRow
                  key={it.id}
                  className={cn(
                    'hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer',
                    'focus:bg-plugin-subtle focus:outline-none focus:ring-2 focus:ring-plugin-subtle focus:ring-inset',
                  )}
                  tabIndex={0}
                  data-list-item={JSON.stringify(it.raw)}
                  data-plugin-name="your-items"
                  role="button"
                  aria-label={`Open ${it.title || it.id}`}
                  onClick={() => handleOpenForView(it.raw)}
                >
                  <TableCell>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {it.title || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">{it.id}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {it.updatedAt ? it.updatedAt.toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
