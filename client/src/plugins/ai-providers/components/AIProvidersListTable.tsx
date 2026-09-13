import React from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';

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
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListTableSortIcon } from '@/core/ui/ListTableSortIcon';
import { cn } from '@/lib/utils';

import type { ProviderSettings } from '../types/aiProviders';
import type { AIProviderSortField, AIProviderSortOrder } from '../utils/aiProvidersListSort';

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
    <Card className={cn('overflow-hidden', DETAIL_VIEW_CARD_CLASS)}>
      <Table rowBorders={false} containerClassName="overflow-x-hidden" className="table-fixed">
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            <TableHead
              className="min-w-0 overflow-hidden cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('providerKey')}
              aria-sort={
                primarySort === 'providerKey'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate">
                  {t('aiProviders.colProvider', { defaultValue: 'Provider' })}
                </span>
                <ListTableSortIcon active={primarySort === 'providerKey'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead
              className="min-w-0 overflow-hidden cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('status')}
              aria-sort={
                primarySort === 'status'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate">
                  {t('aiProviders.colStatus', { defaultValue: 'Status' })}
                </span>
                <ListTableSortIcon active={primarySort === 'status'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead
              className="min-w-0 overflow-hidden cursor-pointer select-none text-xs hover:bg-muted/50"
              onClick={() => onSort('defaultModel')}
              aria-sort={
                primarySort === 'defaultModel'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate">{t('aiProviders.defaultModel')}</span>
                <ListTableSortIcon active={primarySort === 'defaultModel'} order={sortOrder} />
              </div>
            </TableHead>
            <TableHead className="hidden min-w-0 overflow-hidden text-xs md:table-cell">
              {t('aiProviders.apiKey')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => {
            const title = providerTitle(provider);
            return (
              <TableRow
                key={provider.providerKey}
                className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80"
                onClick={() => onRowClick(provider)}
                data-list-item={JSON.stringify(provider)}
                data-plugin-name="ai-providers"
                role="button"
                aria-label={t('aiProviders.openProvider', { provider: title })}
              >
                <TableCell className="min-w-0 overflow-hidden">
                  <span
                    className="block min-w-0 truncate font-extrabold text-foreground transition-colors group-hover:text-primary"
                    title={title}
                  >
                    {title}
                  </span>
                  <div
                    className="truncate text-xs text-muted-foreground"
                    title={provider.providerKey}
                  >
                    {provider.providerKey}
                  </div>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden">
                  <Badge className={cn(BADGE_CHIP_CLASS, enabledBadgeClass(provider.enabled))}>
                    {provider.enabled
                      ? t('aiProviders.statusEnabled')
                      : t('aiProviders.statusDisabled')}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden text-xs text-muted-foreground">
                  <span
                    className="block min-w-0 truncate"
                    title={provider.defaultModel || undefined}
                  >
                    {provider.defaultModel || '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden min-w-0 overflow-hidden text-xs text-muted-foreground md:table-cell">
                  {provider.hasApiKey
                    ? t('aiProviders.keyConfigured')
                    : t('aiProviders.keyMissing')}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
