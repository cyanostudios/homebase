import { CalendarDays, Inbox, Info, StickyNote, Trophy, Users } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { BADGE_CHIP_CLASS, QC_TEAM_STATUS_BADGE_COLORS } from '@/core/ui/badgeStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { QuickContextSection } from '@/core/ui/QuickContextSection';
import {
  QuickContextHeaderActions,
  QuickContextOpenFullFooter,
} from '@/core/ui/QuickContextHeaderActions';
import {
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';
import { MatchQuickInfoDialog } from '@/plugins/matches/components/MatchQuickInfoDialog';
import { formatMatchDateTime, type Match } from '@/plugins/matches/types/match';
import { requestsApi } from '@/plugins/requests/api/requestsApi';
import { RequestQuickInfoDialog } from '@/plugins/requests/components/RequestQuickInfoDialog';
import type { Request } from '@/plugins/requests/types/requests';
import {
  formatRequestStatusForDisplay,
  getTypeLabel,
  isOpenRequestStatus,
} from '@/plugins/requests/types/requests';

import type { Team, TrainingTime } from '../types/teams';
import {
  isTeamOnBreak,
  TEAM_COLOR_GRADIENTS,
  teamColorGradientTextClass,
  WEEK_DAYS,
} from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';

import { TeamSeriesTeamBadges } from './TeamSeriesTeamBadges';
const REQUESTS_PREVIEW_LIMIT = 4;
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

function getNextTraining(team: Team): TrainingTime | null {
  const trainings = (team.training_times || []).filter((entry) => entry.day);
  if (!trainings.length) {
    return null;
  }
  const todayIndex = (new Date().getDay() + 6) % 7;
  let best: TrainingTime | null = null;
  let bestOffset = Number.MAX_SAFE_INTEGER;
  for (const training of trainings) {
    const dayIndex = WEEK_DAYS.indexOf(training.day as (typeof WEEK_DAYS)[number]);
    if (dayIndex < 0) {
      continue;
    }
    const offset = (dayIndex - todayIndex + 7) % 7;
    if (offset < bestOffset) {
      bestOffset = offset;
      best = training;
    }
  }
  return best ?? trainings[0];
}

function formatMatchTeamsLine(match: Match): string {
  return `${match.home_team} – ${match.away_team}`;
}

export function TeamQuickContextPanel({
  team,
  nextMatch = null,
  onClose,
  onOpenFullProfile,
  onEdit,
  variant = 'list',
}: {
  team: Team;
  nextMatch?: Match | null;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  /** `list` = small preview beside the list; `full` = first column in full detail view. */
  variant?: 'list' | 'full';
}) {
  const isFullView = variant === 'full';
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useTimeFormat();
  const enabledPlugins = useEnabledPlugins();
  const hasRequestsPlugin = enabledPlugins.has('requests');

  const [teamRequests, setTeamRequests] = useState<Request[] | null>(null);
  const [viewingMatch, setViewingMatch] = useState<Match | null>(null);
  const [viewingRequest, setViewingRequest] = useState<Request | null>(null);

  const title = formatTeamLabel(team) || team.name;
  const onSeasonBreak = isTeamOnBreak(team);
  const statusKey = onSeasonBreak ? 'break' : team.status;
  const nextTraining = getNextTraining(team);
  const responsiblesCount = Array.isArray(team.responsibles) ? team.responsibles.length : 0;
  const notes = Array.isArray(team.team_notes)
    ? team.team_notes.filter((note) => note.text?.trim())
    : [];
  const latestNote = notes.length > 0 ? notes[notes.length - 1]?.text.trim() : '';
  const updatedLabel = team.updated_at
    ? new Date(team.updated_at).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  useEffect(() => {
    setViewingMatch(null);
    setViewingRequest(null);
    if (!hasRequestsPlugin || !team?.id) {
      setTeamRequests(null);
      return;
    }

    let cancelled = false;
    setTeamRequests(null);
    requestsApi
      .getRequests({ team_id: Number(team.id) })
      .then((data) => {
        if (cancelled) {
          return;
        }
        const open = data.filter((request) => isOpenRequestStatus(request.status));
        setTeamRequests(open);
      })
      .catch(() => {
        if (!cancelled) {
          setTeamRequests([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasRequestsPlugin, team?.id]);

  const navigateToRequest = (request: Request) => {
    setViewingRequest(null);
    navigate(`/requests/${buildSlug(request, teamRequests ?? [request], 'title')}`);
  };

  const navigateToMatch = (match: Match) => {
    setViewingMatch(null);
    navigate(`/matches/${buildSlug(match, [match], 'name')}`);
  };

  const metaLine = useMemo(
    () =>
      [
        team.name?.trim() && team.name.trim() !== title ? team.name.trim() : null,
        team.gender ? t(`teams.gender.${team.gender}`) : null,
        team.playing_format,
      ]
        .filter(Boolean)
        .join(' · ') || '—',
    [team.gender, team.name, team.playing_format, t, title],
  );

  const previewRequests = (teamRequests ?? []).slice(0, REQUESTS_PREVIEW_LIMIT);
  const hiddenRequestCount = Math.max(0, (teamRequests?.length ?? 0) - REQUESTS_PREVIEW_LIMIT);

  const nextTrainingLabel = nextTraining
    ? `${t('teams.nextTraining', {
        day: t(`teams.daysShort.${nextTraining.day}`),
        time: nextTraining.startTime,
      })}${nextTraining.location ? ` · ${nextTraining.location}` : ''}`
    : t('teams.quickContext.noTraining');

  const identityHeader = (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold',
          TEAM_COLOR_GRADIENTS[team.color],
          teamColorGradientTextClass(team.color),
        )}
        aria-hidden
      >
        {(team.age_group || team.name).slice(0, 3).toUpperCase()}
      </div>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 flex-1')}>{title}</h3>
      <QuickContextHeaderActions
        onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
        onEdit={onEdit}
        onClose={!isFullView && onClose ? onClose : undefined}
        editLabel={t('common.edit')}
        closeLabel={t('common.close')}
      />
    </div>
  );

  const statusBadge = (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <Badge
        className={cn(
          'shrink-0',
          BADGE_CHIP_CLASS,
          QC_TEAM_STATUS_BADGE_COLORS[statusKey] ?? QC_TEAM_STATUS_BADGE_COLORS.active,
        )}
      >
        {t(`teams.status.${statusKey}`)}
      </Badge>
    </div>
  );

  const updatedWithBadges = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{metaLine}</p>
        {updatedLabel ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('common.updated')} {updatedLabel}
          </p>
        ) : null}
      </div>
      {statusBadge}
    </div>
  );

  return (
    <>
      <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'flex min-w-0 flex-col')}>
        <div className="border-b border-border/50 px-4 py-5">{identityHeader}</div>

        <div
          className={cn(
            'min-w-0 overflow-x-hidden px-4 py-4',
            isFullView ? 'space-y-4' : 'space-y-6',
          )}
        >
          {!isFullView ? (
            <QuickContextSection title={t('teams.view.information')} icon={Info} iconPlugin="teams">
              {updatedWithBadges}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <Users className="h-3 w-3" />
                    {t('teams.table.players')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    {t('teams.playerCount', { count: team.player_count })}
                  </div>
                </div>
                <div>
                  <div className={FACT_LABEL_CLASS}>
                    <Users className="h-3 w-3" />
                    {t('teams.quickContext.responsibles')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>
                    {t('teams.quickContext.responsibleCount', { count: responsiblesCount })}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className={FACT_LABEL_CLASS}>
                    <CalendarDays className="h-3 w-3" />
                    {t('teams.quickContext.nextTraining')}
                  </div>
                  <div className={DETAIL_FIELD_VALUE_CLASS}>{nextTrainingLabel}</div>
                </div>
                {notes.length > 0 ? (
                  <div>
                    <div className={FACT_LABEL_CLASS}>{t('teams.quickContext.notes')}</div>
                    <div className={DETAIL_FIELD_VALUE_CLASS}>
                      {t('teams.quickContext.noteCount', { count: notes.length })}
                    </div>
                  </div>
                ) : null}
              </div>
            </QuickContextSection>
          ) : (
            updatedWithBadges
          )}

          <QuickContextSection title={t('teams.table.seriesTeams')} icon={Users} iconPlugin="teams">
            <TeamSeriesTeamBadges
              team={team}
              empty={<span className="text-xs text-muted-foreground">—</span>}
            />
          </QuickContextSection>

          {!isFullView && nextMatch ? (
            <QuickContextSection
              title={t('teams.quickContext.nextMatch')}
              icon={Trophy}
              iconPlugin="matches"
            >
              <QuickContextLinkTileGrid>
                <QuickContextLinkTile
                  label={formatMatchDateTime(nextMatch.start_time, i18n.language)}
                  icon={Trophy}
                  iconClassName="text-amber-600"
                  onClick={() => setViewingMatch(nextMatch)}
                >
                  {formatMatchTeamsLine(nextMatch)}
                </QuickContextLinkTile>
              </QuickContextLinkTileGrid>
            </QuickContextSection>
          ) : null}

          {hasRequestsPlugin ? (
            <QuickContextSection
              title={t('teams.quickContext.requests')}
              icon={Inbox}
              iconPlugin="requests"
            >
              {teamRequests === null ? (
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              ) : teamRequests.length > 0 ? (
                <>
                  <QuickContextLinkTileGrid>
                    {previewRequests.map((request) => (
                      <QuickContextLinkTile
                        key={request.id}
                        label={formatRequestStatusForDisplay(request.status, t)}
                        icon={Inbox}
                        iconClassName="text-purple-600"
                        onClick={() => setViewingRequest(request)}
                      >
                        {request.title || getTypeLabel(request.requestType, t)}
                      </QuickContextLinkTile>
                    ))}
                  </QuickContextLinkTileGrid>
                  {hiddenRequestCount > 0 ? (
                    <p className="pt-1.5 text-center text-xs text-muted-foreground">
                      {t('requests.moreCount', { count: hiddenRequestCount })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t('requests.noYetForTeam')}</p>
              )}
            </QuickContextSection>
          ) : null}

          {latestNote ? (
            <QuickContextSection title={t('teams.tabs.notes')} icon={StickyNote} iconPlugin="notes">
              <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                  {latestNote}
                </p>
              </div>
            </QuickContextSection>
          ) : null}
        </div>

        {!isFullView && onOpenFullProfile ? (
          <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
        ) : null}
      </Card>

      <MatchQuickInfoDialog
        isOpen={viewingMatch !== null}
        match={viewingMatch}
        onClose={() => setViewingMatch(null)}
        onOpenMatch={() => {
          if (viewingMatch) {
            navigateToMatch(viewingMatch);
          }
        }}
      />

      <RequestQuickInfoDialog
        isOpen={viewingRequest !== null}
        request={viewingRequest}
        onClose={() => setViewingRequest(null)}
        onOpenRequest={() => {
          if (viewingRequest) {
            navigateToRequest(viewingRequest);
          }
        }}
      />
    </>
  );
}
