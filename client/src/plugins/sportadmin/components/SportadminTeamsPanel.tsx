// client/src/plugins/sportadmin/components/SportadminTeamsPanel.tsx
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  Info,
  Link2,
  Mail,
  Newspaper,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { nextListTableSort } from '@/core/list/listViewMode';
import { DETAIL_HEADER_BELOW_MENUS_CLASS } from '@/core/ui/DetailHeaderMenus';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_ENTITY_LINK_TRIGGER_CLASS,
  DETAIL_FIELD_LABEL_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { ListEmptyState } from '@/core/ui/ListEmptyState';
import { ImageLightbox } from '@/core/ui/ImageLightbox';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { RichTextContent } from '@/core/ui/RichTextContent';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { sportadminApi } from '../api/sportadminApi';
import type { SportadminStatus, SportadminTeamItem } from '../types/sportadmin';
import { formatSportadminDateTime } from '../utils/formatSportadminDate';

import { SportadminSectionCard } from './SportadminSectionCard';
import { SportadminStaleBanner } from './SportadminStaleBanner';
import { SportadminTeamsListTable, type SportadminTeamSortField } from './SportadminTeamsListTable';

type SportadminTeamDetailTab =
  | 'description'
  | 'info'
  | 'news'
  | 'matches'
  | 'roster'
  | 'contact'
  | 'source';

function compareTeams(a: SportadminTeamItem, b: SportadminTeamItem, order: 'asc' | 'desc'): number {
  const cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
  return order === 'asc' ? cmp : -cmp;
}

function teamHeaderImage(team: SportadminTeamItem): string | null {
  return team.description_image_url || team.source_image_url || null;
}

function teamMetaLine(team: SportadminTeamItem): string {
  return [team.category, team.age_group]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(' · ');
}

export function SportadminTeamsPanel({ status }: { status: SportadminStatus | null }) {
  const { t } = useTranslation();
  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const showDesktopSplit = !isCompactViewport;

  const [teams, setTeams] = useState<SportadminTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageBroken, setImageBroken] = useState(false);
  const [primarySort, setPrimarySort] = useState<SportadminTeamSortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [detailTab, setDetailTab] = useState<SportadminTeamDetailTab>('description');

  const configured = Boolean(status?.siteUrl);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await sportadminApi.getTeams();
      const list = Array.isArray(rows) ? rows : [];
      setTeams(list);
      setSelectedId((prev) => (prev && list.some((row) => row.id === prev) ? prev : null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t('sportadmin.teams.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams, status?.lastSuccessfulSync]);

  useEffect(() => {
    setImageBroken(false);
    setDetailTab('description');
  }, [selectedId]);

  const sortedTeams = useMemo(() => {
    const copy = [...teams];
    copy.sort((a, b) => compareTeams(a, b, sortOrder));
    return copy;
  }, [teams, primarySort, sortOrder]);

  const selected = useMemo(
    () => (selectedId ? (teams.find((team) => team.id === selectedId) ?? null) : null),
    [selectedId, teams],
  );

  const showList = showDesktopSplit || !selected;
  const showDetail = showDesktopSplit || Boolean(selected);

  const emptyListMessage = !configured
    ? t('sportadmin.teams.emptyNotConfigured')
    : t('sportadmin.teams.emptyNoTeams');

  const handleSort = (field: SportadminTeamSortField) => {
    const next = nextListTableSort(primarySort, sortOrder, field, () => true);
    setPrimarySort(next.field);
    setSortOrder(next.order);
  };

  const handleSelect = (team: SportadminTeamItem) => {
    setSelectedId(team.id);
  };

  const handleBack = () => {
    setSelectedId(null);
  };

  const newsCount = selected?.news_items?.length ?? 0;
  const matchCount =
    (selected?.upcoming_matches?.length ?? 0) + (selected?.played_matches?.length ?? 0);
  const rosterCount = (selected?.players?.length ?? 0) + (selected?.leaders?.length ?? 0);

  const detailTabs = useMemo(
    () => [
      {
        id: 'description' as const,
        label: t('sportadmin.teams.tabs.description'),
        icon: FileText,
        count: null as number | null,
      },
      {
        id: 'info' as const,
        label: t('sportadmin.teams.tabs.info'),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'news' as const,
        label: t('sportadmin.teams.tabs.news'),
        icon: Newspaper,
        count: newsCount > 0 ? newsCount : null,
      },
      {
        id: 'matches' as const,
        label: t('sportadmin.teams.tabs.matches'),
        icon: CalendarDays,
        count: matchCount > 0 ? matchCount : null,
      },
      {
        id: 'roster' as const,
        label: t('sportadmin.teams.tabs.roster'),
        icon: Users,
        count: rosterCount > 0 ? rosterCount : null,
      },
      {
        id: 'contact' as const,
        label: t('sportadmin.teams.tabs.contact'),
        icon: Mail,
        count: null as number | null,
      },
      {
        id: 'source' as const,
        label: t('sportadmin.teams.tabs.source'),
        icon: Link2,
        count: null as number | null,
      },
    ],
    [t, newsCount, matchCount, rosterCount],
  );

  const listPane = (
    <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
      {teams.length === 0 ? (
        <ListEmptyState message={emptyListMessage} />
      ) : (
        <SportadminTeamsListTable
          teams={sortedTeams}
          primarySort={primarySort}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleSelect}
          activeTeamId={selectedId}
        />
      )}
    </div>
  );

  const headerImage = selected ? teamHeaderImage(selected) : null;
  const metaLine = selected ? teamMetaLine(selected) : '';

  const detailPane = (
    <div
      className="min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain pr-1"
      aria-label={t('sportadmin.teams.detailRegion')}
      role="region"
    >
      {!showDesktopSplit && selected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 h-8 gap-1.5 px-2 text-xs"
          onClick={handleBack}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          {t('sportadmin.teams.backToList')}
        </Button>
      ) : null}

      {!selected ? (
        <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.selectPrompt')}</p>
      ) : (
        <>
          <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
            <div className="px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                {headerImage && !imageBroken ? (
                  <img
                    src={headerImage}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover sm:h-14 sm:w-14"
                    onError={() => setImageBroken(true)}
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 sm:h-14 sm:w-14">
                    <Users className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'truncate text-xl leading-tight')}>
                    {selected.name}
                  </h3>
                  {selected.heading &&
                  selected.heading.trim() &&
                  selected.heading.trim().toLowerCase() !== selected.name.trim().toLowerCase() ? (
                    <p className="truncate text-sm text-muted-foreground">{selected.heading}</p>
                  ) : null}
                  {metaLine ? (
                    <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
                  ) : null}
                </div>
              </div>

              <div
                className={cn(LIST_FILTER_CHIP_ROW_CLASS, DETAIL_HEADER_BELOW_MENUS_CLASS)}
                role="tablist"
                aria-label={t('sportadmin.teams.detailRegion')}
              >
                {detailTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = detailTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      type="button"
                      role="tab"
                      variant="ghost"
                      size="sm"
                      aria-selected={isActive}
                      aria-pressed={isActive}
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
                      )}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      <span>
                        {tab.label}
                        {tab.count != null ? (
                          <>
                            {' '}
                            <span className="tabular-nums font-semibold">({tab.count})</span>
                          </>
                        ) : null}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </Card>

          {detailTab === 'description' ? (
            <SportadminSectionCard title={t('sportadmin.teams.description')} icon={FileText}>
              <div className="space-y-3">
                {selected.description_image_url ? (
                  <ImageLightbox
                    src={selected.description_image_url}
                    alt={selected.name || ''}
                    resetKey={`${selected.id}:${detailTab}`}
                    imageClassName="max-h-56 max-w-full rounded-md object-contain object-left"
                    onThumbnailError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                {selected.description?.trim() ? (
                  <RichTextContent content={selected.description} />
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>
                    {t('sportadmin.teams.emptyDescription')}
                  </p>
                )}
              </div>
            </SportadminSectionCard>
          ) : null}

          {detailTab === 'info' ? (
            <SportadminSectionCard title={t('sportadmin.teams.identity')} icon={Info}>
              <div className="space-y-3">
                <div>
                  <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.columnName')}</p>
                  <p className={DETAIL_FIELD_VALUE_CLASS}>{selected.name}</p>
                </div>
                {selected.heading?.trim() ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.heading')}</p>
                    <p className="text-sm text-foreground">{selected.heading}</p>
                  </div>
                ) : null}
                {selected.category ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.category')}</p>
                    <p className="text-sm text-foreground">{selected.category}</p>
                  </div>
                ) : null}
                {selected.age_group ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.ageGroup')}</p>
                    <p className="text-sm text-foreground">{selected.age_group}</p>
                  </div>
                ) : null}
                {!selected.heading?.trim() && !selected.category && !selected.age_group ? (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyInfo')}</p>
                ) : null}
              </div>
            </SportadminSectionCard>
          ) : null}

          {detailTab === 'news' ? (
            <SportadminSectionCard title={t('sportadmin.teams.news')} icon={Newspaper}>
              {selected.news_items && selected.news_items.length > 0 ? (
                <ul className="list-none space-y-4">
                  {selected.news_items.map((row, index) => (
                    <li
                      key={row.nid ? `news-${row.nid}` : `news-${index}-${row.title}`}
                      className="space-y-2 border-b border-border/50 pb-4 last:border-0 last:pb-0"
                    >
                      {row.image_url ? (
                        <ImageLightbox
                          src={row.image_url}
                          alt={row.title || ''}
                          resetKey={`${selected.id}:${detailTab}:${row.nid ?? index}`}
                          imageClassName="max-h-56 max-w-full rounded-md object-contain object-left"
                          onThumbnailError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className="min-w-0 space-y-1">
                        {row.source_url ? (
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              DETAIL_ENTITY_LINK_TRIGGER_CLASS,
                              'inline-flex items-center',
                            )}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            {t('sportadmin.teams.openSource')}
                          </a>
                        ) : null}
                        {row.title?.trim() ? (
                          <p className={DETAIL_FIELD_VALUE_CLASS}>{row.title}</p>
                        ) : null}
                        {row.when ? (
                          <p className="text-xs text-muted-foreground">{row.when}</p>
                        ) : null}
                        {row.body?.trim() ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                            {row.body}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyNews')}</p>
              )}
            </SportadminSectionCard>
          ) : null}

          {detailTab === 'matches' ? (
            <div className="space-y-3">
              <SportadminSectionCard
                title={t('sportadmin.teams.upcomingMatches')}
                icon={CalendarDays}
              >
                {selected.upcoming_matches && selected.upcoming_matches.length > 0 ? (
                  <ul className="list-none space-y-2">
                    {selected.upcoming_matches.map((row, index) => (
                      <li
                        key={`up-${index}-${row.title}`}
                        className="border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <p className="text-sm font-medium text-foreground">{row.title}</p>
                        {row.when ? (
                          <p className="text-xs text-muted-foreground">{row.when}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyUpcoming')}</p>
                )}
              </SportadminSectionCard>
              <SportadminSectionCard
                title={t('sportadmin.teams.playedMatches')}
                icon={CalendarDays}
              >
                {selected.played_matches && selected.played_matches.length > 0 ? (
                  <ul className="list-none space-y-2">
                    {selected.played_matches.map((row, index) => (
                      <li
                        key={`pl-${index}-${row.title}`}
                        className="border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <p className="text-sm font-medium text-foreground">{row.title}</p>
                        {row.when ? (
                          <p className="text-xs text-muted-foreground">{row.when}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyPlayed')}</p>
                )}
              </SportadminSectionCard>
            </div>
          ) : null}

          {detailTab === 'roster' ? (
            <div className="space-y-3">
              <SportadminSectionCard title={t('sportadmin.teams.players')} icon={Users}>
                {selected.players && selected.players.length > 0 ? (
                  <ul className="list-none space-y-2">
                    {selected.players.map((row, index) => (
                      <li
                        key={
                          row.source_user_id ? `p-${row.source_user_id}` : `p-${index}-${row.name}`
                        }
                        className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{row.name}</p>
                          {row.description ? (
                            <p className="text-xs text-muted-foreground">{row.description}</p>
                          ) : null}
                        </div>
                        {row.age ? (
                          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {row.age}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyPlayers')}</p>
                )}
              </SportadminSectionCard>
              <SportadminSectionCard title={t('sportadmin.teams.leaders')} icon={Users}>
                {selected.leaders && selected.leaders.length > 0 ? (
                  <ul className="list-none space-y-2">
                    {selected.leaders.map((row, index) => (
                      <li
                        key={
                          row.source_user_id ? `l-${row.source_user_id}` : `l-${index}-${row.name}`
                        }
                        className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{row.name}</p>
                          {row.description ? (
                            <p className="text-xs text-muted-foreground">{row.description}</p>
                          ) : null}
                        </div>
                        {row.age ? (
                          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {row.age}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyLeaders')}</p>
                )}
              </SportadminSectionCard>
            </div>
          ) : null}

          {detailTab === 'contact' ? (
            <SportadminSectionCard title={t('sportadmin.teams.contact')} icon={Mail}>
              {selected.contact?.trim() ? (
                <RichTextContent content={selected.contact} />
              ) : (
                <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.emptyContact')}</p>
              )}
            </SportadminSectionCard>
          ) : null}

          {detailTab === 'source' ? (
            <SportadminSectionCard title={t('sportadmin.teams.source')} icon={Link2}>
              <div className="space-y-3">
                {selected.source_url ? (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(DETAIL_ENTITY_LINK_TRIGGER_CLASS, 'inline-flex items-center')}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    {t('sportadmin.teams.openSource')}
                  </a>
                ) : (
                  <p className={DETAIL_EMPTY_STATE_CLASS}>{t('sportadmin.teams.noSourceUrl')}</p>
                )}
                {selected.imported_at ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.importedAt')}</p>
                    <p className="text-sm text-foreground">
                      {formatSportadminDateTime(selected.imported_at)}
                    </p>
                  </div>
                ) : null}
                {selected.updated_at ? (
                  <div>
                    <p className={DETAIL_FIELD_LABEL_CLASS}>{t('sportadmin.teams.updatedAt')}</p>
                    <p className="text-sm text-foreground">
                      {formatSportadminDateTime(selected.updated_at)}
                    </p>
                  </div>
                ) : null}
              </div>
            </SportadminSectionCard>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 space-y-2">
        <SportadminStaleBanner
          lastSuccessfulSync={status?.lastSuccessfulSync ?? null}
          lastError={status?.lastError ?? null}
        />
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
        {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
      </div>

      {!loading ? (
        <div
          className={cn(
            'min-h-0 flex-1',
            showDesktopSplit
              ? 'grid grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-2'
              : 'overflow-hidden',
          )}
        >
          {showList ? listPane : null}
          {showDetail ? detailPane : null}
        </div>
      ) : null}
    </div>
  );
}
