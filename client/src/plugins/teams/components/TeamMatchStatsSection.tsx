import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { matchesApi } from '@/plugins/matches/api/matchesApi';
import { MatchSideSplitSection } from '@/plugins/matches/components/stats/MatchSideSplitSection';
import type { Match } from '@/plugins/matches/types/match';
import { MATCHES_SETTINGS_KEY } from '@/plugins/matches/utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '@/plugins/matches/utils/matchDefaultHomeTeam';
import { computeMatchStats } from '@/plugins/matches/utils/matchStats';

interface TeamMatchStatsSectionProps {
  teamId: string;
  teamName: string;
}

export function TeamMatchStatsSection({ teamId, teamName }: TeamMatchStatsSectionProps) {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [matches, setMatches] = useState<Match[]>([]);
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    matchesApi
      .getMatchesByTeam(teamId)
      .then((data) => {
        if (!cancelled) setMatches(data);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

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

  const teamBlock = useMemo(() => {
    const teamNameById = new Map([[String(teamId), teamName]]);
    const stats = computeMatchStats(matches, defaultHomeTeam, teamNameById);
    return stats.teams.find((block) => block.teamId === String(teamId)) ?? null;
  }, [matches, defaultHomeTeam, teamId, teamName]);

  const hasDefaultHomeTeam = defaultHomeTeam.trim().length > 0;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!hasDefaultHomeTeam) {
    return (
      <p className="text-sm text-muted-foreground">{t('teams.view.matchStatisticsNeedsDefault')}</p>
    );
  }

  if (!teamBlock || teamBlock.overall.total.played === 0) {
    return <p className="text-sm text-muted-foreground">{t('teams.view.matchStatisticsEmpty')}</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('teams.view.matchStatisticsDescription')}</p>
      <div>
        <p className="text-sm font-medium text-foreground">{t('matches.statistics.allYears')}</p>
        <MatchSideSplitSection sides={teamBlock.overall} />
      </div>
      {teamBlock.years.map((yearBlock) => (
        <div key={yearBlock.year}>
          <p className="text-sm font-medium text-foreground">{yearBlock.year}</p>
          <MatchSideSplitSection sides={yearBlock.sides} />
        </div>
      ))}
    </div>
  );
}
