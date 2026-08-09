import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { DetailSection } from '@/core/ui/DetailSection';

import { useMatchStats } from '../../hooks/useMatchStats';
import { MATCHES_SETTINGS_KEY } from '../../utils/matchColumnCount';
import { resolveMatchDefaultHomeTeam } from '../../utils/matchDefaultHomeTeam';

import { MatchSideSplitSection } from './MatchSideSplitSection';

export function MatchStats() {
  const { t } = useTranslation();
  const { getSettings, settingsVersion } = useApp();
  const [defaultHomeTeam, setDefaultHomeTeam] = useState('');

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

  return (
    <div className="space-y-6">
      {!stats.hasDefaultHomeTeam ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {t('matches.statistics.missingDefaultHomeTeam')}
        </p>
      ) : null}

      <DetailSection title={t('matches.statistics.club')} subtleTitle>
        {stats.hasDefaultHomeTeam && stats.club.overall.total.played > 0 ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('matches.statistics.allYears')}
              </p>
              <MatchSideSplitSection sides={stats.club.overall} />
            </div>
            {stats.club.years.map((yearBlock) => (
              <div key={yearBlock.year}>
                <p className="text-sm font-medium text-foreground">{yearBlock.year}</p>
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

      <DetailSection title={t('matches.statistics.byTeam')} subtleTitle>
        {!stats.hasDefaultHomeTeam ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('matches.statistics.teamNeedsDefault')}
          </p>
        ) : stats.teams.length > 0 ? (
          <div className="space-y-8">
            {stats.teams.map((teamBlock) => (
              <div key={teamBlock.teamId} className="space-y-6">
                <p className="text-base font-semibold tracking-tight">{teamBlock.teamName}</p>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('matches.statistics.allYears')}
                  </p>
                  <MatchSideSplitSection sides={teamBlock.overall} />
                </div>
                {teamBlock.years.map((yearBlock) => (
                  <div key={`${teamBlock.teamId}-${yearBlock.year}`}>
                    <p className="text-sm font-medium text-foreground">{yearBlock.year}</p>
                    <MatchSideSplitSection sides={yearBlock.sides} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('matches.statistics.noTeamMatches')}
          </p>
        )}
      </DetailSection>
    </div>
  );
}
