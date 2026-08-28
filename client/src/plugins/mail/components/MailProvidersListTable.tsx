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
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListTableSortIcon } from '@/core/ui/ListColumnLayoutToggle';
import { cn } from '@/lib/utils';

import type { MailProviderSettings } from '../types/mail';
import type { MailProviderSortField, MailProviderSortOrder } from '../utils/mailListSort';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-extrabold';

function enabledBadgeClass(enabled: boolean) {
  return enabled
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

const SORTABLE_COLUMNS: {
  field: MailProviderSortField;
  labelKey: string;
  defaultLabel: string;
  className?: string;
}[] = [
  { field: 'providerKey', labelKey: 'mail.colProvider', defaultLabel: 'Provider' },
  { field: 'status', labelKey: 'mail.colStatus', defaultLabel: 'Status' },
  { field: 'capability', labelKey: 'mail.capability', defaultLabel: 'Capability' },
];

export type MailProvidersListTableProps = {
  providers: MailProviderSettings[];
  primarySort: MailProviderSortField;
  sortOrder: MailProviderSortOrder;
  onSort: (field: MailProviderSortField) => void;
  onRowClick: (provider: MailProviderSettings) => void;
  providerTitle: (provider: MailProviderSettings) => string;
};

export function MailProvidersListTable({
  providers,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  providerTitle,
}: MailProvidersListTableProps) {
  const { t } = useTranslation();

  return (
    <Card className={cn('overflow-hidden', DETAIL_VIEW_CARD_CLASS)}>
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
              {t('mail.credentials', { defaultValue: 'Credentials' })}
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
                data-plugin-name="mail"
                role="button"
                aria-label={t('mail.openProvider', {
                  defaultValue: 'Open {{provider}}',
                  provider: title,
                })}
              >
                <TableCell>
                  <span className="font-extrabold text-foreground transition-colors group-hover:text-primary">
                    {title}
                  </span>
                  <div className="text-xs text-muted-foreground">{provider.providerKey}</div>
                </TableCell>
                <TableCell>
                  <Badge className={cn(BADGE_CLASS, enabledBadgeClass(provider.enabled))}>
                    {provider.enabled
                      ? t('mail.statusEnabled', { defaultValue: 'Enabled' })
                      : t('mail.statusDisabled', { defaultValue: 'Disabled' })}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {provider.emailCapable
                    ? t('mail.emailCapable', { defaultValue: 'Email' })
                    : t('mail.notEmailCapable', { defaultValue: 'Not email capable' })}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {provider.configured
                    ? t('mail.keyConfigured', { defaultValue: 'Configured' })
                    : t('mail.keyMissing', { defaultValue: 'Missing' })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
