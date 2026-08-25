import { Building2, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { DetailSection, SubtleSectionHeading } from '@/core/ui/DetailSection';
import {
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { cn } from '@/lib/utils';

import { useMatchStats } from '../../hooks/useMatchStats';
import { MATCHES_SETTINGS_KEY } from '../../utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '../../utils/matchDefaultHomeTeam';

import { MatchSideSplitSection } from './MatchSideSplitSection';

/** Multi-select team ids; empty = all teams (same semantics as Schedule). */
function toggleStatsTeamFilter(prev: string[], teamId: string): string[] {
  if (prev.includes(teamId)) {
    return prev.filter((id) => id !== teamId);
  }
  return [...prev, teamId];
}

export function MatchStats() {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [teamFilter, setTeamFilter] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getSettings(MATCHES_SETTINGS_KEY)
      .then((settings) => {
        if (!cancelled) {
          setDefaultHomeTeam(resolveMatchDefaultHomeTeam(settings));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDefaultHomeTeam('');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getSettings, settingsVersion]);

  const stats = useMatchStats(defaultHomeTeam);

  const filteredTeams = useMemo(() => {
    if (teamFilter.length === 0) {
      return stats.teams;
    }
    const selected = new Set(teamFilter);
    return stats.teams.filter((block) => selected.has(block.teamId));
  }, [stats.teams, teamFilter]);

  // Drop filter ids that no longer appear in stats (e.g. after data reload).
  useEffect(() => {
    if (teamFilter.length === 0) {
      return;
    }
    const available = new Set(stats.teams.map((block) => block.teamId));
    const next = teamFilter.filter((id) => available.has(id));
    if (next.length !== teamFilter.length) {
      setTeamFilter(next);
    }
  }, [stats.teams, teamFilter]);

  return (
    <div className="space-y-4">
      {!stats.hasDefaultHomeTeam ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {t('matches.statistics.missingDefaultHomeTeam')}
        </p>
      ) : null}

      {stats.hasDefaultHomeTeam && stats.teams.length > 0 ? (
        <div className={LIST_FILTER_CHIP_ROW_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setTeamFilter([])}
            className={cn(
              teamFilter.length === 0 ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS,
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              {t('matches.filterAll')}{' '}
              <span className="tabular-nums font-semibold">({stats.teams.length})</span>
            </span>
          </Button>
          {stats.teams.map((teamBlock) => {
            const isActive = teamFilter.includes(teamBlock.teamId);
            return (
              <Button
                key={teamBlock.teamId}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={isActive}
                onClick={() =>
                  setTeamFilter((prev) => toggleStatsTeamFilter(prev, teamBlock.teamId))
                }
                className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="truncate">{teamBlock.teamName}</span>
              </Button>
            );
          })}
        </div>
      ) : null}

      {teamFilter.length === 0 ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('matches.statistics.club')}
            icon={Building2}
            subtleTitle
            className="p-6"
          >
            {stats.hasDefaultHomeTeam && stats.club.overall.total.played > 0 ? (
              <div className="mt-3 space-y-4">
                <div>
                  <SubtleSectionHeading title={t('matches.statistics.allYears')} />
                  <MatchSideSplitSection sides={stats.club.overall} />
                </div>
                {stats.club.years.map((yearBlock) => (
                  <div key={yearBlock.year}>
                    <SubtleSectionHeading title={String(yearBlock.year)} />
                    <MatchSideSplitSection sides={yearBlock.sides} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {stats.hasDefaultHomeTeam
                  ? t('matches.statistics.noCountedMatches')
                  : t('matches.statistics.clubNeedsDefault')}
              </p>
            )}
          </DetailSection>
        </Card>
      ) : null}

      {!stats.hasDefaultHomeTeam ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('matches.statistics.byTeam')}
            icon={Users}
            subtleTitle
            className="p-6"
          >
            <p className="mt-2 text-sm text-muted-foreground">
              {t('matches.statistics.teamNeedsDefault')}
            </p>
          </DetailSection>
        </Card>
      ) : filteredTeams.length > 0 ? (
        <div className="space-y-4">
          {filteredTeams.map((teamBlock) => (
            <Card key={teamBlock.teamId} padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection title={teamBlock.teamName} icon={Users} subtleTitle className="p-6">
                <div className="mt-3 space-y-4">
                  <div>
                    <SubtleSectionHeading title={t('matches.statistics.allYears')} />
                    <MatchSideSplitSection sides={teamBlock.overall} />
                  </div>
                  {teamBlock.years.map((yearBlock) => (
                    <div key={`${teamBlock.teamId}-${yearBlock.year}`}>
                      <SubtleSectionHeading title={String(yearBlock.year)} />
                      <MatchSideSplitSection sides={yearBlock.sides} />
                    </div>
                  ))}
                </div>
              </DetailSection>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('matches.statistics.byTeam')}
            icon={Users}
            subtleTitle
            className="p-6"
          >
            <p className="mt-2 text-sm text-muted-foreground">
              {teamFilter.length > 0
                ? t('matches.statistics.noTeamsMatchFilter')
                : t('matches.statistics.noTeamMatches')}
            </p>
          </DetailSection>
        </Card>
      )}
    </div>
  );
}
