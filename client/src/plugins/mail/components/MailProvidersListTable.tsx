import { Mail } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_CHIP_CLASS, QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';

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
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListTableSortIcon } from '@/core/ui/ListTableSortIcon';
import { cn } from '@/lib/utils';

import type { MailProviderSettings } from '../types/mail';
import type { MailProviderSortField, MailProviderSortOrder } from '../utils/mailListSort';
import {
  DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS,
  type MailProvidersTableColumnId,
  resolveVisibleMailProvidersTableColumns,
} from '../utils/mailProvidersTableColumns';

function enabledBadgeClass(enabled: boolean) {
  return enabled ? QC_STATUS_BADGE_COLORS.success : QC_STATUS_BADGE_COLORS.neutral;
}

function mailProviderIdentityMeta(
  provider: MailProviderSettings,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  const parts: string[] = [];
  parts.push(
    provider.enabled
      ? t('mail.statusEnabled', { defaultValue: 'Enabled' })
      : t('mail.statusDisabled', { defaultValue: 'Disabled' }),
  );
  parts.push(
    provider.emailCapable
      ? t('mail.emailCapable', { defaultValue: 'Email' })
      : t('mail.notEmailCapable', { defaultValue: 'Not email capable' }),
  );
  parts.push(
    provider.configured
      ? t('mail.keyConfigured', { defaultValue: 'Configured' })
      : t('mail.keyMissing', { defaultValue: 'Missing' }),
  );
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type MailProvidersListTableProps = {
  providers: MailProviderSettings[];
  primarySort: MailProviderSortField;
  sortOrder: MailProviderSortOrder;
  onSort: (field: MailProviderSortField) => void;
  onRowClick: (provider: MailProviderSettings) => void;
  providerTitle: (provider: MailProviderSettings) => string;
  visibleColumnIds?: MailProvidersTableColumnId[];
  activeProviderId?: string | null;
};

export function MailProvidersListTable({
  providers,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  providerTitle,
  visibleColumnIds,
  activeProviderId = null,
}: MailProvidersListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleMailProvidersTableColumns({
      tableColumns: DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS,
    });
  }, [visibleColumnIds]);

  const columnHeaders = useMemo(() => {
    const headers: Record<
      MailProvidersTableColumnId,
      { label: string; sortField?: MailProviderSortField; className?: string }
    > = {
      provider: {
        label: t('mail.colProvider', { defaultValue: 'Provider' }),
        sortField: 'providerKey',
      },
      status: {
        label: t('mail.colStatus', { defaultValue: 'Status' }),
        sortField: 'status',
      },
      capability: {
        label: t('mail.capability', { defaultValue: 'Capability' }),
        sortField: 'capability',
      },
      credentials: {
        label: t('mail.credentials', { defaultValue: 'Credentials' }),
        className: 'hidden md:table-cell',
      },
    };
    return headers;
  }, [t]);

  return (
    <Card className={cn('overflow-hidden', DETAIL_VIEW_CARD_CLASS)}>
      <Table rowBorders={false} containerClassName="overflow-x-hidden" className="table-fixed">
        <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
          <TableRow>
            {orderedVisibleIds.map((columnId) => {
              const header = columnHeaders[columnId];
              const sortField = header.sortField;
              return (
                <TableHead
                  key={columnId}
                  className={cn(
                    'min-w-0 overflow-hidden text-xs',
                    sortField ? 'cursor-pointer select-none hover:bg-muted/50' : '',
                    header.className,
                  )}
                  onClick={sortField ? () => onSort(sortField) : undefined}
                  aria-sort={
                    sortField && primarySort === sortField
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate">{header.label}</span>
                    {sortField ? (
                      <ListTableSortIcon active={primarySort === sortField} order={sortOrder} />
                    ) : null}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => {
            const title = providerTitle(provider);
            const identityMeta = mailProviderIdentityMeta(provider, t);
            const isActive = activeProviderId != null && provider.providerKey === activeProviderId;
            return (
              <TableRow
                key={provider.providerKey}
                className={cn(
                  'group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80',
                  isActive && 'bg-sky-50/80 dark:bg-sky-950/30',
                )}
                onClick={() => onRowClick(provider)}
                data-list-item={JSON.stringify(provider)}
                data-plugin-name="mail"
                role="button"
                aria-label={t('mail.openProvider', {
                  defaultValue: 'Open {{provider}}',
                  provider: title,
                })}
              >
                {orderedVisibleIds.map((columnId) => {
                  if (columnId === 'provider') {
                    return (
                      <TableCell key={columnId} className="min-w-0 overflow-hidden">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              title={t('nav.mail', { defaultValue: 'Mail' })}
                              className="inline-flex shrink-0"
                            >
                              <SectionCategoryIcon
                                icon={Mail}
                                className="h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3"
                              />
                            </span>
                            <span
                              className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                              title={title}
                            >
                              {title}
                            </span>
                          </div>
                          {identityMeta ? (
                            <span className="min-w-0 truncate pl-6 text-[10px] font-normal leading-tight tabular-nums text-slate-400 dark:text-slate-500">
                              {identityMeta}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    );
                  }
                  if (columnId === 'status') {
                    return (
                      <TableCell key={columnId} className="min-w-0 overflow-hidden">
                        <Badge
                          className={cn(BADGE_CHIP_CLASS, enabledBadgeClass(provider.enabled))}
                        >
                          {provider.enabled
                            ? t('mail.statusEnabled', { defaultValue: 'Enabled' })
                            : t('mail.statusDisabled', { defaultValue: 'Disabled' })}
                        </Badge>
                      </TableCell>
                    );
                  }
                  if (columnId === 'capability') {
                    return (
                      <TableCell
                        key={columnId}
                        className="min-w-0 overflow-hidden text-xs text-muted-foreground"
                      >
                        {provider.emailCapable
                          ? t('mail.emailCapable', { defaultValue: 'Email' })
                          : t('mail.notEmailCapable', { defaultValue: 'Not email capable' })}
                      </TableCell>
                    );
                  }
                  if (columnId === 'credentials') {
                    return (
                      <TableCell
                        key={columnId}
                        className="hidden min-w-0 overflow-hidden text-xs text-muted-foreground md:table-cell"
                      >
                        {provider.configured
                          ? t('mail.keyConfigured', { defaultValue: 'Configured' })
                          : t('mail.keyMissing', { defaultValue: 'Missing' })}
                      </TableCell>
                    );
                  }
                  return null;
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
