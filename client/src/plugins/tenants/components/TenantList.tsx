// client/src/plugins/tenants/components/TenantList.tsx
import { Building2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Switch } from '@/components/ui/switch';
import { RoundExpandableSearch } from '@/components/ui/round-expandable-search';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import {
  PLUGIN_PAGE_HEADER_CLASS,
  PLUGIN_PAGE_LIST_SHELL_CLASS,
  PLUGIN_PAGE_SECTION_GAP_CLASS,
  PLUGIN_PAGE_SUBTITLE_CLASS,
  PLUGIN_PAGE_TITLE_CLASS,
} from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import { tenantsApi } from '../api/tenantsApi';
import type { TenantDetail, TenantListItem } from '../types/tenants';

export function TenantList() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [search, setSearch] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const rows = await tenantsApi.list();
      setTenants(rows);
      if (rows.length && selectedId == null) {
        setSelectedId(rows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tenants.loadFailed'));
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedId, t]);

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setIsLoadingDetail(true);
    setSaveMessage(null);
    void tenantsApi
      .get(selectedId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null);
          setError(err instanceof Error ? err.message : t('tenants.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((row) => {
      const hay = `${row.id} ${row.ownerEmail ?? ''} ${row.organizationName ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tenants, search]);

  const onToggle = async (pluginName: string, enabled: boolean) => {
    if (!detail || isSaving || detail.pluginsLocked) return;
    const row = detail.plugins.find((p) => p.pluginName === pluginName);
    if (!row?.toggleable) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const next = await tenantsApi.updatePlugins(detail.id, {
        enable: enabled ? [pluginName] : [],
        disable: enabled ? [] : [pluginName],
      });
      setDetail(next);
      setTenants((prev) =>
        prev.map((row) =>
          row.id === next.id
            ? {
                ...row,
                enabledPluginCount: next.plugins.filter((p) => p.enabled).length,
              }
            : row,
        ),
      );
      setSaveMessage(t('tenants.savedRelogin'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tenants.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(PLUGIN_PAGE_LIST_SHELL_CLASS, 'flex h-full min-h-0 flex-col')}>
      <div className={cn(PLUGIN_PAGE_SECTION_GAP_CLASS, 'flex min-h-0 flex-1 flex-col')}>
        <div className={cn(PLUGIN_PAGE_HEADER_CLASS, 'shrink-0')}>
          <div className="min-w-0">
            <h1 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.tenants')}</h1>
            <p className={PLUGIN_PAGE_SUBTITLE_CLASS}>{t('tenants.subtitle')}</p>
          </div>
          <RoundExpandableSearch
            value={search}
            onChange={setSearch}
            placeholder={t('tenants.searchPlaceholder')}
          />
        </div>

        {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
        {saveMessage ? (
          <p className="shrink-0 text-sm text-muted-foreground">{saveMessage}</p>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
          <div className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-h-0 flex-col overflow-hidden p-0')}>
            <div className="shrink-0 border-b px-4 py-3 text-sm font-medium">
              {t('tenants.listTitle')}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {isLoadingList ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t('common.loading')}</p>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6">
                  <ListEmptyState message={t('tenants.noYet')} />
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((row) => {
                    const active = row.id === selectedId;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.id)}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors',
                            active ? 'bg-primary/10' : 'hover:bg-muted/60',
                          )}
                        >
                          <span className="truncate text-sm font-semibold">
                            {row.organizationName || row.ownerEmail || `#${row.id}`}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.ownerEmail || t('tenants.noEmail')} · id {row.id}
                            {row.pluginsLocked
                              ? ` · ${t('tenants.lockedBadge')}`
                              : ` · ${t('tenants.enabledCount', { count: row.enabledPluginCount })}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div
            className={cn(
              DETAIL_VIEW_CARD_CLASS,
              'min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6',
            )}
          >
            {!selectedId ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 text-muted-foreground">
                <Building2 className="size-8 opacity-40" />
                <p className="text-sm">{t('tenants.selectHint')}</p>
              </div>
            ) : isLoadingDetail || !detail ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {detail.organizationName || detail.ownerEmail || `#${detail.id}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {detail.ownerEmail || t('tenants.noEmail')} · id {detail.id}
                  </p>
                  {detail.pluginsLocked ? (
                    <p className="mt-2 text-sm text-muted-foreground">{t('tenants.lockedHint')}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{t('tenants.reloginHint')}</p>
                  )}
                </div>
                <ul className="divide-y rounded-md border">
                  {detail.plugins.map((plugin) => (
                    <li
                      key={plugin.pluginName}
                      className="flex items-center justify-between gap-4 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{plugin.pluginName}</span>
                        {plugin.publicApp ? (
                          <p className="text-xs text-muted-foreground">
                            {t('tenants.publicAppHint')}
                          </p>
                        ) : null}
                      </div>
                      {plugin.toggleable ? (
                        <Switch
                          checked={plugin.enabled}
                          disabled={isSaving}
                          onCheckedChange={(checked) => {
                            void onToggle(plugin.pluginName, checked);
                          }}
                        />
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {plugin.publicApp
                            ? t('tenants.publicAppLabel')
                            : plugin.enabled
                              ? t('common.on')
                              : t('common.off')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
