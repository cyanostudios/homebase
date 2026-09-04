import { ListOrdered, Trophy } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { matchesApi } from '../../api/matchesApi';
import { formatMatchDateTime } from '../../types/match';
import type { MatchSeriesCompetition, MatchSeriesResponse } from '../../types/matchSeries';

function formatScore(match: {
  home_score: number | null;
  away_score: number | null;
  result: string | null;
}): string {
  if (match.home_score != null && match.away_score != null) {
    return `${match.home_score}–${match.away_score}`;
  }
  if (match.result?.trim()) {
    return match.result.trim();
  }
  return '–';
}

export function MatchSeriesStats() {
  const { t, i18n } = useTranslation();
  const { teams } = useTeams();
  const fogisTeams = useMemo(
    () =>
      teams
        .filter((team) => team.external_team_id != null && String(team.external_team_id).trim())
        .slice()
        .sort((a, b) =>
          (formatTeamLabel(a) || a.name).localeCompare(formatTeamLabel(b) || b.name, undefined, {
            sensitivity: 'base',
          }),
        ),
    [teams],
  );

  const [teamId, setTeamId] = useState('');
  const [competitionKey, setCompetitionKey] = useState('');
  const [data, setData] = useState<MatchSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId && fogisTeams.length > 0) {
      setTeamId(String(fogisTeams[0].id));
    }
  }, [fogisTeams, teamId]);

  useEffect(() => {
    if (!teamId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    matchesApi
      .getSeries(teamId)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        const preferred =
          response.competitions.find((c) => c.isActive)?.name ||
          response.competitions[0]?.name ||
          '';
        setCompetitionKey(preferred);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message || '')
            : '';
        setError(message || t('matches.series.loadFailed'));
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, t]);

  const selectedCompetition: MatchSeriesCompetition | null = useMemo(() => {
    if (!data || !competitionKey) return null;
    return data.competitions.find((c) => c.name === competitionKey) || data.competitions[0] || null;
  }, [data, competitionKey]);

  const filteredMatches = useMemo(() => {
    if (!data || !selectedCompetition?.name) return [];
    const name = selectedCompetition.name;
    return data.matches
      .filter((m) => m.competition_name === name)
      .slice()
      .sort((a, b) => String(b.start_time).localeCompare(String(a.start_time)));
  }, [data, selectedCompetition]);

  if (fogisTeams.length === 0) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
        {t('matches.series.noFogisTeams')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={LIST_FILTER_CHIP_ROW_CLASS}>
        {fogisTeams.map((team) => {
          const id = String(team.id);
          const active = teamId === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTeamId(id)}
              className={cn(active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
            >
              {formatTeamLabel(team) || team.name}
            </Button>
          );
        })}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{t('matches.loading')}</p> : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data && data.competitions.length > 0 ? (
        <div className={LIST_FILTER_CHIP_ROW_CLASS}>
          {data.competitions.map((competition) => {
            const name = competition.name || '';
            const active = selectedCompetition?.name === name;
            return (
              <Button
                key={`${competition.competitionId ?? 'x'}-${name}`}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCompetitionKey(name)}
                className={cn(active ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                {name}
                {competition.isActive ? (
                  <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                    {t('matches.series.active')}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
      ) : null}

      {!loading && data && data.competitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('matches.series.noCompetitions')}</p>
      ) : null}

      {selectedCompetition ? (
        <>
          <DetailSection
            icon={Trophy}
            title={t('matches.series.tableTitle')}
            subtleTitle
            className="space-y-2"
          >
            <p className="text-xs text-muted-foreground">
              {selectedCompetition.standingsSource === 'fogis'
                ? t('matches.series.sourceFogis')
                : selectedCompetition.standingsSource === 'derived'
                  ? t('matches.series.sourceDerived')
                  : t('matches.series.sourceNone')}
            </p>
            {selectedCompetition.standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filteredMatches.length > 0
                  ? t('matches.series.noStandingsNoScores')
                  : t('matches.series.noStandings')}
              </p>
            ) : (
              <Card className={cn(DETAIL_VIEW_CARD_CLASS, 'overflow-x-auto p-0')}>
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">{t('matches.team')}</th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        {t('matches.statistics.played')}
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        {t('matches.statistics.won')}
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        {t('matches.statistics.drawn')}
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        {t('matches.statistics.lost')}
                      </th>
                      <th className="px-3 py-2 font-medium tabular-nums">+/−</th>
                      <th className="px-3 py-2 font-medium tabular-nums">
                        {t('matches.statistics.points')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCompetition.standings.map((row) => (
                      <tr
                        key={`${row.position}-${row.teamName}`}
                        className={cn(
                          'border-b last:border-0',
                          row.isOwnClub && 'bg-primary/5 font-medium',
                        )}
                      >
                        <td className="px-3 py-2 tabular-nums">{row.position ?? '–'}</td>
                        <td className="px-3 py-2">{row.teamName}</td>
                        <td className="px-3 py-2 tabular-nums">{row.played}</td>
                        <td className="px-3 py-2 tabular-nums">{row.won}</td>
                        <td className="px-3 py-2 tabular-nums">{row.drawn}</td>
                        <td className="px-3 py-2 tabular-nums">{row.lost}</td>
                        <td className="px-3 py-2 tabular-nums">{row.goalDifference}</td>
                        <td className="px-3 py-2 tabular-nums">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </DetailSection>

          <DetailSection icon={ListOrdered} title={t('matches.series.matchesTitle')} subtleTitle>
            {filteredMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('matches.series.noMatches')}</p>
            ) : (
              <Card className={cn(DETAIL_VIEW_CARD_CLASS, 'divide-y p-0')}>
                {filteredMatches.map((match) => (
                  <div
                    key={match.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {match.home_team} – {match.away_team}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMatchDateTime(match.start_time, i18n.language)}
                        {match.is_canceled
                          ? ` · ${t('matches.statusCanceled')}`
                          : match.is_postponed
                            ? ` · ${t('matches.statusPostponed')}`
                            : null}
                      </div>
                    </div>
                    <div className="tabular-nums font-semibold">{formatScore(match)}</div>
                  </div>
                ))}
              </Card>
            )}
          </DetailSection>
        </>
      ) : null}
    </div>
  );
}
