import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListTableSortIcon } from '@/core/ui/ListColumnLayoutToggle';
import { cn } from '@/lib/utils';

import type { ProviderSettings } from '../types/aiProviders';
import type { AIProviderSortField, AIProviderSortOrder } from '../utils/aiProvidersListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function enabledBadgeClass(enabled: boolean) {
  return enabled
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

export type AIProvidersListTableProps = {
  providers: ProviderSettings[];
  primarySort: AIProviderSortField;
  sortOrder: AIProviderSortOrder;
  onSort: (field: AIProviderSortField) => void;
  onRowClick: (provider: ProviderSettings) => void;
  providerTitle: (provider: ProviderSettings) => string;
};

export function AIProvidersListTable({
  providers,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  providerTitle,
}: AIProvidersListTableProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
      <Table rowBorders={false}>
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            <TableHead
              className="cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('providerKey')}
              aria-sort={
                primarySort === 'providerKey'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center gap-2">
                <span>{t('aiProviders.colProvider', { defaultValue: 'Provider' })}</span>
                <ListTableSortIcon active={primarySort === 'providerKey'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('status')}
              aria-sort={
                primarySort === 'status'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center gap-2">
                <span>{t('aiProviders.colStatus', { defaultValue: 'Status' })}</span>
                <ListTableSortIcon active={primarySort === 'status'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('defaultModel')}
              aria-sort={
                primarySort === 'defaultModel'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center gap-2">
                <span>{t('aiProviders.defaultModel')}</span>
                <ListTableSortIcon active={primarySort === 'defaultModel'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead className="hidden text-xs md:table-cell">
              {t('aiProviders.apiKey')}
            </TableHead>
            <TableHead
              className="hidden cursor-pointer select-none text-right text-xs hover:bg-muted/50 lg:table-cell"
              onClick={() => onSort('updatedAt')}
              aria-sort={
                primarySort === 'updatedAt'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center justify-end gap-2">
                <span>{t('common.updated')}</span>
                <ListTableSortIcon active={primarySort === 'updatedAt'} order={sortOrder} />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => {
            const title = providerTitle(provider);
            return (
              <TableRow
                key={provider.providerKey}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80"
                onClick={() => onRowClick(provider)}
                data-list-item={JSON.stringify(provider)}
                data-plugin-name="ai-providers"
                role="button"
                aria-label={t('aiProviders.openProvider', { provider: title })}
              >
                <TableCell>
                  <span className="font-medium text-foreground">{title}</span>
                  <div className="text-xs text-muted-foreground">{provider.providerKey}</div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(BADGE_CLASS, enabledBadgeClass(provider.enabled))}>
                    {provider.enabled
                      ? t('aiProviders.statusEnabled')
                      : t('aiProviders.statusDisabled')}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {provider.defaultModel || '—'}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {provider.hasApiKey
                    ? t('aiProviders.keyConfigured')
                    : t('aiProviders.keyMissing')}
                </TableCell>
                <TableCell className="hidden text-right text-xs text-muted-foreground lg:table-cell">
                  {provider.updatedAt ? new Date(provider.updatedAt).toLocaleDateString() : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
