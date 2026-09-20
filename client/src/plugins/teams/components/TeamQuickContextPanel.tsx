import { CheckCircle2, Circle, Moon, Pause, Users, type LucideIcon } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { QC_TEAM_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
  DetailHeaderMetaRow,
} from '@/core/ui/DetailHeaderMenus';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { SectionCategoryIcon } from '@/core/ui/DetailSection';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { StatusOutlineBadge } from '@/core/ui/StatusOutlineBadge';
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

function teamStatusIcon(statusKey: string): LucideIcon {
  switch (statusKey) {
    case 'active':
      return CheckCircle2;
    case 'dormant':
      return Moon;
    case 'break':
      return Pause;
    default:
      return Circle;
  }
}

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
  const updatedLabel = team.updated_at
    ? new Date(team.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

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

  return (
    <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
      <div className={cn('px-4 py-5', !headerBelow ? 'border-b border-border/50' : null)}>
        <TeamDetailHeaderMenus team={team} leading={titleLeading} />
        <div
          className={cn(
            DETAIL_HEADER_BELOW_MENUS_CLASS,
            'flex min-w-0 flex-col',
            DETAIL_HEADER_CHIP_GAP_CLASS,
          )}
        >
          <p className="text-sm text-muted-foreground">{fullHeaderMetaLine}</p>
          <DetailHeaderMetaRow className="mt-0">
            <span className="text-xs text-muted-foreground">
              {t('teams.playerCount', { count: team.player_count })}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('teams.seriesTeamCount', { count: seriesTeamsDisplayCount })}
            </span>
            {updatedLabel ? (
              <p className="min-w-0 text-xs text-muted-foreground">
                {t('common.updated')} {updatedLabel}
              </p>
            ) : null}
            <StatusOutlineBadge
              icon={teamStatusIcon(statusKey)}
              className={
                QC_TEAM_STATUS_BADGE_COLORS[statusKey] ?? QC_TEAM_STATUS_BADGE_COLORS.active
              }
            >
              {t(`teams.status.${statusKey}`)}
            </StatusOutlineBadge>
          </DetailHeaderMetaRow>
        </div>
        {headerBelow ? <div className="mt-4">{headerBelow}</div> : null}
      </div>
    </Card>
  );
}
