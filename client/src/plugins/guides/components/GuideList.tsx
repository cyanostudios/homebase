import { ArrowDown, ArrowUp, List as ListIcon, Plus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
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
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useGuides } from '../hooks/useGuides';
import { formatGuideLifecycleStatus, type Guide } from '../types/guides';

type SortField = 'displayName' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const GuideList: React.FC = () => {
  const { t } = useTranslation();
  const { guides, openGuidePanel, openGuideForView } = useGuides();
  const { attemptNavigation } = useGlobalNavigationGuard();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('displayName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );
  };

  return (
    <div className="plugin-guides min-h-full bg-background">
      <div className="px-6 py-4">
        <Card className="overflow-hidden border border-border/70 bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">{t('guides.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('guides.listDescription')}</p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openGuidePanel(null))}
            >
              {t('guides.addPlace')}
            </Button>
          </div>

          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('guides.searchPlaceholder', { count: guides.length })}
                className="h-9 pl-9 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={ListIcon}
              className="h-9 px-3 text-xs"
              disabled
            >
              {t('common.list')}
            </Button>
          </div>

          {filteredAndSorted.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {searchTerm ? t('guides.noMatch') : t('guides.noYet')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-24 cursor-pointer"
                    onClick={() => handleSort('displayName')}
                  >
                    {t('guides.colId')} <SortIcon field="displayName" />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('displayName')}>
                    {t('guides.colName')} <SortIcon field="displayName" />
                  </TableHead>
                  <TableHead>{t('guides.colLocation')}</TableHead>
                  <TableHead>{t('guides.colStatus')}</TableHead>
                  <TableHead>{t('guides.colSourceLanguage')}</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('updatedAt')}>
                    {t('guides.colUpdated')} <SortIcon field="updatedAt" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.map((guide) => (
                  <TableRow
                    key={guide.id}
                    className={cn(
                      'plugin-guides hover:bg-plugin-subtle focus:bg-plugin-subtle focus:outline-none focus:ring-2 focus:ring-plugin-subtle focus:ring-inset cursor-pointer',
                    )}
                    tabIndex={0}
                    data-list-item={JSON.stringify(guide)}
                    data-plugin-name="guides"
                    role="button"
                    aria-label={t('guides.openPlace', { name: guide.displayName })}
                    onClick={() => handleOpenForView(guide)}
                  >
                    <TableCell className="font-mono text-xs">
                      {formatDisplayNumber('guides', guide.id)}
                    </TableCell>
                    <TableCell className="font-medium">{guide.displayName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {guide.geographicReference || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatGuideLifecycleStatus(guide.lifecycleStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="uppercase">{guide.sourceLanguage}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(guide.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};
