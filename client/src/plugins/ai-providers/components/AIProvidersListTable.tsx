import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QC_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';

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
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
import { cn } from '@/lib/utils';

import type { ProviderSettings } from '../types/aiProviders';
import type { AIProviderSortField, AIProviderSortOrder } from '../utils/aiProvidersListSort';
import {
  DEFAULT_AI_PROVIDERS_TABLE_COLUMNS,
  type AIProvidersTableColumnId,
  resolveVisibleAIProvidersTableColumns,
} from '../utils/aiProvidersTableColumns';

const AI_PROVIDER_ICON_SHELL_CLASS =
  'h-5 w-5 bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 [&_svg]:h-3 [&_svg]:w-3';

function aiProviderIdentityMeta(
  provider: ProviderSettings,
  t: (key: string) => string,
): string | null {
  const parts: string[] = [];
  const model = provider.defaultModel?.trim();
  if (model) {
    parts.push(model);
  }
  parts.push(provider.hasApiKey ? t('aiProviders.keyConfigured') : t('aiProviders.keyMissing'));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export type AIProvidersListTableProps = {
  providers: ProviderSettings[];
  primarySort: AIProviderSortField;
  sortOrder: AIProviderSortOrder;
  onSort: (field: AIProviderSortField) => void;
  onRowClick: (provider: ProviderSettings) => void;
  providerTitle: (provider: ProviderSettings) => string;
  visibleColumnIds?: AIProvidersTableColumnId[];
  activeProviderId?: string | null;
};

export function AIProvidersListTable({
  providers,
  primarySort,
  sortOrder,
  onSort,
  onRowClick,
  providerTitle,
  visibleColumnIds,
  activeProviderId = null,
}: AIProvidersListTableProps) {
  const { t } = useTranslation();

  const orderedVisibleIds = useMemo(() => {
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      return visibleColumnIds;
    }
    return resolveVisibleAIProvidersTableColumns({
      tableColumns: DEFAULT_AI_PROVIDERS_TABLE_COLUMNS,
    });
  }, [visibleColumnIds]);

  const columnHeaders = useMemo(() => {
    const headers: Record<
      AIProvidersTableColumnId,
      { label: string; sortField?: AIProviderSortField; className?: string }
    > = {
      provider: {
        label: t('aiProviders.colProvider', { defaultValue: 'Provider' }),
        sortField: 'providerKey',
      },
      status: {
        label: t('aiProviders.colStatus', { defaultValue: 'Status' }),
        sortField: 'status',
      },
      defaultModel: {
        label: t('aiProviders.defaultModel'),
        sortField: 'defaultModel',
      },
      apiKey: {
        label: t('aiProviders.apiKey'),
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
            const identityMeta = aiProviderIdentityMeta(provider, t);
            const isActive = activeProviderId != null && provider.providerKey === activeProviderId;
            const statusLabel = provider.enabled
              ? t('aiProviders.statusEnabled')
              : t('aiProviders.statusDisabled');
            return (
              <TableRow
                key={provider.providerKey}
                className={cn(
                  'group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/80',
                  isActive && 'bg-sky-50/80 dark:bg-sky-950/30',
                )}
                onClick={() => onRowClick(provider)}
                data-list-item={JSON.stringify(provider)}
                data-plugin-name="ai-providers"
                role="button"
                aria-label={t('aiProviders.openProvider', { provider: title })}
              >
                {orderedVisibleIds.map((columnId) => {
                  if (columnId === 'provider') {
                    return (
                      <TableCell key={columnId} className="min-w-0 overflow-hidden">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span title={title} className="inline-flex shrink-0">
                              <SectionCategoryIcon
                                icon={Sparkles}
                                className={AI_PROVIDER_ICON_SHELL_CLASS}
                              />
                            </span>
                            <span
                              className="min-w-0 truncate font-extrabold leading-4 text-foreground transition-colors group-hover:text-primary"
                              title={title}
                            >
                              {title}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-center gap-1.5 pl-6">
                            <span
                              className={cn(
                                'shrink-0 text-[10px] font-extrabold leading-tight',
                                provider.enabled
                                  ? QC_STATUS_BADGE_COLORS.success
                                  : QC_STATUS_BADGE_COLORS.neutral,
                              )}
                            >
                              {statusLabel}
                            </span>
                            {identityMeta ? (
                              <span className="min-w-0 truncate text-[10px] font-normal leading-tight tabular-nums text-slate-400 dark:text-slate-500">
                                {identityMeta}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                    );
                  }
                  if (columnId === 'status') {
                    return (
                      <TableCell key={columnId} className="min-w-0 overflow-hidden">
                        <StatusOutlineBadge
                          icon={provider.enabled ? CheckCircle2 : Circle}
                          className={
                            provider.enabled
                              ? QC_STATUS_BADGE_COLORS.success
                              : QC_STATUS_BADGE_COLORS.neutral
                          }
                        >
                          {statusLabel}
                        </StatusOutlineBadge>
                      </TableCell>
                    );
                  }
                  if (columnId === 'defaultModel') {
                    return (
                      <TableCell
                        key={columnId}
                        className="min-w-0 overflow-hidden text-xs text-muted-foreground"
                      >
                        <span
                          className="block min-w-0 truncate"
                          title={provider.defaultModel || undefined}
                        >
                          {provider.defaultModel || '—'}
                        </span>
                      </TableCell>
                    );
                  }
                  if (columnId === 'apiKey') {
                    return (
                      <TableCell
                        key={columnId}
                        className="hidden min-w-0 overflow-hidden text-xs text-muted-foreground md:table-cell"
                      >
                        {provider.hasApiKey
                          ? t('aiProviders.keyConfigured')
                          : t('aiProviders.keyMissing')}
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
