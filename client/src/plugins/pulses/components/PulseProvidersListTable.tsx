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

import type { PulseProviderSettings } from '../types/pulse';
import type { PulseProviderSortField, PulseProviderSortOrder } from '../utils/pulseListSort';

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
    <Card className={cn('overflow-hidden', DETAIL_VIEW_CARD_CLASS)}>
      <Table rowBorders={false} containerClassName="overflow-x-hidden" className="table-fixed">
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={cn(
                  'min-w-0 overflow-hidden cursor-pointer select-none text-xs hover:bg-muted/50',
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
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate">
                    {t(col.labelKey, { defaultValue: col.defaultLabel })}
                  </span>
                  <ListTableSortIcon active={primarySort === col.field} order={sortOrder} />
                </div>
              </TableHead>
            ))}
            <TableHead className="hidden min-w-0 overflow-hidden text-xs md:table-cell">
              {t('pulses.credentials', { defaultValue: 'Credentials' })}
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
                data-plugin-name="pulses"
                role="button"
                aria-label={t('pulses.openProvider', {
                  defaultValue: 'Open {{provider}}',
                  provider: title,
                })}
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
                      ? t('pulses.statusEnabled', { defaultValue: 'Enabled' })
                      : t('pulses.statusDisabled', { defaultValue: 'Disabled' })}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-0 overflow-hidden text-xs text-muted-foreground">
                  {provider.smsNotificationCapable
                    ? t('pulses.smsCapable', { defaultValue: 'SMS' })
                    : t('pulses.verifyOnly', { defaultValue: 'Verify only' })}
                </TableCell>
                <TableCell className="hidden min-w-0 overflow-hidden text-xs text-muted-foreground md:table-cell">
                  {provider.configured
                    ? t('pulses.keyConfigured', { defaultValue: 'Configured' })
                    : t('pulses.keyMissing', { defaultValue: 'Missing' })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
