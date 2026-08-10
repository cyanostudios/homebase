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

import type { PulseProviderSettings } from '../types/pulse';
import type { PulseProviderSortField, PulseProviderSortOrder } from '../utils/pulseListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function enabledBadgeClass(enabled: boolean) {
  return enabled
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

const SORTABLE_COLUMNS: {
  field: PulseProviderSortField;
  labelKey: string;
  defaultLabel: string;
  className?: string;
}[] = [
  { field: 'providerKey', labelKey: 'pulses.colProvider', defaultLabel: 'Provider' },
  { field: 'status', labelKey: 'pulses.colStatus', defaultLabel: 'Status' },
  { field: 'capability', labelKey: 'pulses.capability', defaultLabel: 'Capability' },
];

export type PulseProvidersListTableProps = {
  providers: PulseProviderSettings[];
  primarySort: PulseProviderSortField;
  sortOrder: PulseProviderSortOrder;
  onSort: (field: PulseProviderSortField) => void;
  onRowClick: (provider: PulseProviderSettings) => void;
  providerTitle: (provider: PulseProviderSettings) => string;
};

export function PulseProvidersListTable({
  providers,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  providerTitle,
}: PulseProvidersListTableProps) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950">
      <Table rowBorders={false}>
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={cn(
                  'cursor-pointer select-none text-xs hover:bg-muted/50',
                  col.className,
                )}
                onClick={() => onSort(col.field)}
                aria-sort={
                  primarySort === col.field
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center gap-2">
                  <span>{t(col.labelKey, { defaultValue: col.defaultLabel })}</span>
                  <ListTableSortIcon active={primarySort === col.field} order={sortOrder} />
                </div>
              </TableHead>
            ))}
            <TableHead className="hidden text-xs md:table-cell">
              {t('pulses.credentials', { defaultValue: 'Credentials' })}
            </TableHead>
            <TableHead
              className="hidden cursor-pointer select-none text-xs hover:bg-muted/50 lg:table-cell"
              onClick={() => onSort('updatedAt')}
              aria-sort={
                primarySort === 'updatedAt'
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <div className="flex items-center gap-2">
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
                data-plugin-name="pulses"
                role="button"
                aria-label={t('pulses.openProvider', {
                  defaultValue: 'Open {{provider}}',
                  provider: title,
                })}
              >
                <TableCell>
                  <span className="font-medium text-foreground">{title}</span>
                  <div className="text-xs text-muted-foreground">{provider.providerKey}</div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(BADGE_CLASS, enabledBadgeClass(provider.enabled))}>
                    {provider.enabled
                      ? t('pulses.statusEnabled', { defaultValue: 'Enabled' })
                      : t('pulses.statusDisabled', { defaultValue: 'Disabled' })}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {provider.smsNotificationCapable
                    ? t('pulses.smsCapable', { defaultValue: 'SMS' })
                    : t('pulses.verifyOnly', { defaultValue: 'Verify only' })}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {provider.configured
                    ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                    : t('pulses.keyMissing', { defaultValue: 'Missing' })}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
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
