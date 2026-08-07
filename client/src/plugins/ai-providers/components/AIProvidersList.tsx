import { ArrowDown, ArrowUp, Grid3x3, List, Plus, Route, Search, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useApp } from '@/core/api/AppContext';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ListFilterStatCard } from '@/core/ui/ListFilterStatCard';
import { formatDate } from '@/core/utils/dateFormat';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';

import { useAIProviders } from '../hooks/useAIProviders';
import type { ProviderSettings } from '../types/aiProviders';

import { AIProvidersRouting } from './AIProvidersRouting';

const AI_PROVIDERS_SETTINGS_KEY = 'ai-providers';
const AI_PROVIDERS_VIEW_MODE_STORAGE_KEY = 'ai-providers:viewMode';

type ViewMode = 'grid' | 'list';
type SortField = 'providerKey' | 'defaultModel' | 'updatedAt';
type SortOrder = 'asc' | 'desc';
type ProviderFilter = 'all' | 'enabled' | 'disabled' | 'configured';

function getInitialViewMode(): ViewMode {
  if (typeof window === 'undefined') {
    return 'list';
  }
  return window.sessionStorage.getItem(AI_PROVIDERS_VIEW_MODE_STORAGE_KEY) === 'grid'
    ? 'grid'
    : 'list';
}

function enabledBadgeClass(enabled: boolean) {
  return enabled
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
}

function providerTitle(
  t: (key: string, opts?: Record<string, unknown>) => string,
  provider: ProviderSettings,
) {
  return t(`aiProviders.providers.${provider.providerKey}.title`, {
    defaultValue: provider.providerKey,
  });
}

export const AIProvidersList: React.FC = () => {
  const { t } = useTranslation();
  const { getSettings, updateSettings, settingsVersion } = useApp();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const {
    providers,
    loading,
    openAIProviderPanel,
    openAIProviderForView,
    aiProvidersContentView,
    openRoutingView,
  } = useAIProviders();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);
  const [activeFilter, setActiveFilter] = useState<ProviderFilter>('all');

  useEffect(() => {
    let cancelled = false;
    getSettings(AI_PROVIDERS_SETTINGS_KEY)
      .then((settings: { viewMode?: ViewMode }) => {
        if (!cancelled) {
          const nextMode: ViewMode = settings?.viewMode === 'grid' ? 'grid' : 'list';
          setViewModeState(nextMode);
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(AI_PROVIDERS_VIEW_MODE_STORAGE_KEY, nextMode);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(AI_PROVIDERS_VIEW_MODE_STORAGE_KEY, mode);
      }
      updateSettings(AI_PROVIDERS_SETTINGS_KEY, { viewMode: mode }).catch(() => {});
    },
    [updateSettings],
  );

  const stats = useMemo(
    () => ({
      total: providers.length,
      enabled: providers.filter((p) => p.enabled).length,
      disabled: providers.filter((p) => !p.enabled).length,
      configured: providers.filter((p) => p.hasApiKey).length,
    }),
    [providers],
  );

  const filteredAndSorted = useMemo(() => {
    const byFilter = providers.filter((provider) => {
      if (activeFilter === 'enabled') {
        return provider.enabled;
      }
      if (activeFilter === 'disabled') {
        return !provider.enabled;
      }
      if (activeFilter === 'configured') {
        return provider.hasApiKey;
      }
      return true;
    });

    const needle = searchTerm.trim().toLowerCase();
    const filtered = byFilter.filter((provider) => {
      if (!needle) {
        return true;
      }
      const title = providerTitle(t, provider).toLowerCase();
      return (
        provider.providerKey.toLowerCase().includes(needle) ||
        title.includes(needle) ||
        provider.defaultModel.toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      const flip = sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'updatedAt') {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return flip * (ta - tb);
      }
      if (sortField === 'providerKey') {
        return (
          flip * a.providerKey.localeCompare(b.providerKey, undefined, { sensitivity: 'base' })
        );
      }
      return (
        flip * a.defaultModel.localeCompare(b.defaultModel, undefined, { sensitivity: 'base' })
      );
    });
  }, [activeFilter, providers, searchTerm, sortField, sortOrder, t]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder(field === 'providerKey' ? 'asc' : 'desc');
      }
    },
    [sortField],
  );

  const handleOpenForView = (provider: ProviderSettings) =>
    attemptNavigation(() => openAIProviderForView(provider));

  const sortIcon = (field: SortField) =>
    sortField === field ? (
      sortOrder === 'asc' ? (
        <ArrowUp className="inline h-3 w-3" />
      ) : (
        <ArrowDown className="inline h-3 w-3" />
      )
    ) : null;

  if (aiProvidersContentView === 'routing') {
    return <AIProvidersRouting />;
  }

  return (
    <div className="plugin-ai-providers min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {t('nav.ai-providers', { defaultValue: 'AI Providers' })}
            </h2>
            <p className="text-sm text-muted-foreground">{t('aiProviders.listDescription')}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Route}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(openRoutingView)}
            >
              {t('aiProviders.routing.open', { defaultValue: 'Routing' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              className="h-9 px-3 text-xs"
              onClick={() => attemptNavigation(() => openAIProviderPanel(null))}
            >
              {t('aiProviders.addProvider')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <ListFilterStatCard
            label={t('aiProviders.filterAll', { defaultValue: 'Total' })}
            value={stats.total}
            dotClassName="bg-blue-500"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <ListFilterStatCard
            label={t('aiProviders.statusEnabled')}
            value={stats.enabled}
            dotClassName="bg-emerald-500"
            active={activeFilter === 'enabled'}
            onClick={() => setActiveFilter('enabled')}
          />
          <ListFilterStatCard
            label={t('aiProviders.statusDisabled')}
            value={stats.disabled}
            dotClassName="bg-amber-500"
            active={activeFilter === 'disabled'}
            onClick={() => setActiveFilter('disabled')}
          />
          <ListFilterStatCard
            label={t('aiProviders.keyConfigured')}
            value={stats.configured}
            dotClassName="bg-rose-500"
            active={activeFilter === 'configured'}
            onClick={() => setActiveFilter('configured')}
          />
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
              'flex flex-shrink-0 items-center justify-between gap-3 px-4 py-3',
              viewMode === 'grid' && 'mx-1 mt-1 rounded-xl bg-white dark:bg-slate-950',
            )}
          >
            <div className="relative w-full max-w-sm md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('aiProviders.searchPlaceholder', { count: providers.length })}
                className="h-8 bg-background pl-9 text-xs"
              />
            </div>
            <div className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5">
              <Button
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
              >
                {t('slots.grid')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={List}
                className={cn(
                  'h-7 rounded-[6px] px-2 text-xs',
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm hover:bg-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setViewMode('list')}
              >
                {t('slots.list')}
              </Button>
            </div>
          </div>

          {loading ? (
            <Card className="shadow-none">
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            </Card>
          ) : filteredAndSorted.length === 0 ? (
            <ListEmptyState
              message={searchTerm.trim() ? t('aiProviders.noMatch') : t('aiProviders.noYet')}
              createLabel={!searchTerm.trim() ? t('aiProviders.addProvider') : undefined}
              onCreate={
                !searchTerm.trim()
                  ? () => attemptNavigation(() => openAIProviderPanel(null))
                  : undefined
              }
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 px-1 pb-1 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredAndSorted.map((provider) => {
                const title = providerTitle(t, provider);
                return (
                  <Card
                    key={provider.providerKey}
                    className="plugin-ai-providers relative flex h-full min-h-[140px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all hover:border-plugin-subtle hover:shadow-md dark:bg-slate-950"
                    onClick={() => handleOpenForView(provider)}
                    data-list-item={JSON.stringify(provider)}
                    data-plugin-name="ai-providers"
                    role="button"
                    aria-label={t('aiProviders.openProvider', { provider: title })}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-plugin-subtle text-plugin">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <Badge
                        className={cn(
                          'rounded-md border-0 px-2 py-0.5 text-xs font-semibold',
                          enabledBadgeClass(provider.enabled),
                        )}
                      >
                        {provider.enabled
                          ? t('aiProviders.statusEnabled')
                          : t('aiProviders.statusDisabled')}
                      </Badge>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{title}</h3>
                    <div className="truncate text-xs text-muted-foreground">
                      {provider.providerKey}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('aiProviders.defaultModel')}: {provider.defaultModel || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('aiProviders.apiKey')}:{' '}
                      {provider.hasApiKey
                        ? t('aiProviders.keyConfigured')
                        : t('aiProviders.keyMissing')}
                    </div>
                    <div className="mt-auto text-[10px] leading-snug text-muted-foreground">
                      {t('common.updated')}:{' '}
                      {provider.updatedAt ? formatDate(provider.updatedAt) : '—'}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-none">
              <Table rowBorders={false}>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('providerKey')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('aiProviders.colProvider', { defaultValue: 'Provider' })}</span>
                        {sortIcon('providerKey')}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs">
                      {t('aiProviders.colStatus', { defaultValue: 'Status' })}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-xs hover:bg-muted/50"
                      onClick={() => handleSort('defaultModel')}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t('aiProviders.defaultModel')}</span>
                        {sortIcon('defaultModel')}
                      </div>
                    </TableHead>
                    <TableHead className="hidden text-xs md:table-cell">
                      {t('aiProviders.apiKey')}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none text-right text-xs hover:bg-muted/50"
                      onClick={() => handleSort('updatedAt')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>{t('common.updated')}</span>
                        {sortIcon('updatedAt')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((provider) => (
                    <TableRow
                      key={provider.providerKey}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenForView(provider)}
                      data-list-item={JSON.stringify(provider)}
                      data-plugin-name="ai-providers"
                      role="button"
                      aria-label={t('aiProviders.openProvider', {
                        provider: providerTitle(t, provider),
                      })}
                    >
                      <TableCell>
                        <span className="font-medium">{providerTitle(t, provider)}</span>
                        <div className="text-xs text-muted-foreground">{provider.providerKey}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'rounded-md border-0 px-2 py-0.5 text-xs font-semibold',
                            enabledBadgeClass(provider.enabled),
                          )}
                        >
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
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {provider.updatedAt ? formatDate(provider.updatedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
          <div
            className={cn(
              'px-4 py-2 text-xs text-muted-foreground',
              viewMode === 'grid'
                ? 'mx-1 mb-1 mt-3 rounded-xl bg-white dark:bg-slate-950'
                : 'border-t border-border/60',
            )}
          >
            {t('aiProviders.showingCount', {
              defaultValue: 'Showing {{visible}} of {{total}} providers',
              visible: filteredAndSorted.length,
              total: providers.length,
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
