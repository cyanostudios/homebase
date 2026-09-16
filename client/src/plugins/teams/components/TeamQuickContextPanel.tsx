import { Users } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BADGE_CHIP_CLASS, QC_TEAM_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

import type { Team } from '../types/teams';
import {
  getDisplaySeriesTeams,
  isTeamOnBreak,
  TEAM_COLOR_GRADIENTS,
  teamColorGradientTextClass,
} from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';

import { TeamDetailHeaderMenus } from './TeamDetailHeaderMenus';

export function TeamQuickContextPanel({
  team,
  headerBelow = null,
}: {
  team: Team;
  headerBelow?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const title = formatTeamLabel(team) || team.name;
  const onSeasonBreak = isTeamOnBreak(team);
  const statusKey = onSeasonBreak ? 'break' : team.status;
  const seriesTeamsDisplayCount = getDisplaySeriesTeams(
    team.series_teams ?? [],
    team.series_team_count ?? 0,
  ).length;

  const fullHeaderMetaLine = useMemo(() => {
    const name = team.name?.trim() || '';
    const age = team.age_group?.trim() || '';
    return (
      [
        name && name !== title ? name : null,
        age && age !== title ? age : null,
        team.gender ? t(`teams.gender.${team.gender}`) : null,
        team.playing_format,
      ]
        .filter(Boolean)
        .join(' · ') || '—'
    );
  }, [team.age_group, team.gender, team.name, team.playing_format, t, title]);

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.team')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={Users}
          className={cn(
            'h-9 w-9 bg-gradient-to-br text-xs font-bold [&_svg]:h-4 [&_svg]:w-4',
            TEAM_COLOR_GRADIENTS[team.color],
            teamColorGradientTextClass(team.color),
          )}
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>{title}</h3>
    </div>
  );

  const statusBadge = (
    <Badge
      className={cn(
        'shrink-0',
        BADGE_CHIP_CLASS,
        QC_TEAM_STATUS_BADGE_COLORS[statusKey] ?? QC_TEAM_STATUS_BADGE_COLORS.active,
      )}
    >
      {t(`teams.status.${statusKey}`)}
    </Badge>
  );

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className={cn('px-4 py-5', !headerBelow ? 'border-b border-border/50' : null)}>
        <TeamDetailHeaderMenus team={team} leading={titleLeading} />
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">{fullHeaderMetaLine}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span>{t('teams.playerCount', { count: team.player_count })}</span>
            <span>{t('teams.seriesTeamCount', { count: seriesTeamsDisplayCount })}</span>
            {statusBadge}
          </div>
        </div>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
