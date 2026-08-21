import { CalendarDays, Edit, Inbox, StickyNote, Trophy, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTimeFormat } from '@/core/settings/useTimeFormat';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { DETAIL_NOTE_CALLOUT_CLASS, DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import { formatMatchDateTime, type Match } from '@/plugins/matches/types/match';
import { requestsApi } from '@/plugins/requests/api/requestsApi';
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
  TEAM_STATUS_BADGES,
  teamColorGradientTextClass,
  WEEK_DAYS,
} from '../types/teams';
import { formatTeamLabel } from '../utils/formatTeamLabel';

import { TeamSeriesTeamBadges } from './TeamSeriesTeamBadges';

const REQUESTS_PREVIEW_LIMIT = 4;

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
}: {
  team: Team;
  nextMatch?: Match | null;
  onClose: () => void;
  onOpenFullProfile: () => void;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  useTimeFormat();
  const enabledPlugins = useEnabledPlugins();
  const hasRequestsPlugin = enabledPlugins.has('requests');

  const [teamRequests, setTeamRequests] = useState<Request[] | null>(null);

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

  const openRequest = (request: Request) => {
    navigate(`/requests/${buildSlug(request, teamRequests ?? [request], 'title')}`);
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

  return (
    <Card
      padding="none"
      className={cn(
        DETAIL_VIEW_CARD_CLASS,
        'flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t('teams.quickContext.eyebrow')}
          </p>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {t('teams.quickContext.title')}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={X}
          className="h-8 w-8 shrink-0 p-0"
          onClick={onClose}
          aria-label={t('common.close')}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold',
              TEAM_COLOR_GRADIENTS[team.color],
              teamColorGradientTextClass(team.color),
            )}
            aria-hidden
          >
            {(team.age_group || team.name).slice(0, 3).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{metaLine}</p>
                {updatedLabel ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('common.updated')} {updatedLabel}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Edit}
                className="h-8 w-8 shrink-0 p-0"
                onClick={onEdit}
                aria-label={t('common.edit')}
                title={t('common.edit')}
              />
            </div>
            <Badge
              className={cn(
                'mt-2 border-0 rounded-md px-2 py-0.5 text-xs font-semibold',
                TEAM_STATUS_BADGES[statusKey],
              )}
            >
              {t(`teams.status.${statusKey}`)}
            </Badge>
          </div>
        </div>

        <QuickContextLinkTileGrid>
          <QuickContextLinkTile label={t('teams.table.players')} icon={Users}>
            {t('teams.playerCount', { count: team.player_count })}
          </QuickContextLinkTile>
          <QuickContextLinkTile label={t('teams.quickContext.responsibles')} icon={Users}>
            {t('teams.quickContext.responsibleCount', { count: responsiblesCount })}
          </QuickContextLinkTile>
        </QuickContextLinkTileGrid>

        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {t('teams.table.seriesTeams')}
          </p>
          <TeamSeriesTeamBadges
            team={team}
            empty={<span className="text-xs text-muted-foreground">—</span>}
          />
        </div>

        <QuickContextLinkTileGrid>
          <QuickContextLinkTile label={t('teams.quickContext.nextTraining')} icon={CalendarDays}>
            {nextTraining
              ? `${t('teams.nextTraining', {
                  day: t(`teams.daysShort.${nextTraining.day}`),
                  time: nextTraining.startTime,
                })}${nextTraining.location ? ` · ${nextTraining.location}` : ''}`
              : t('teams.quickContext.noTraining')}
          </QuickContextLinkTile>
          {nextMatch ? (
            <QuickContextLinkTile
              label={t('teams.quickContext.nextMatch')}
              icon={Trophy}
              iconClassName="text-amber-600"
            >
              {t('teams.nextMatchMeta', {
                when: formatMatchDateTime(nextMatch.start_time, i18n.language),
                teams: formatMatchTeamsLine(nextMatch),
              })}
            </QuickContextLinkTile>
          ) : null}
        </QuickContextLinkTileGrid>

        {hasRequestsPlugin ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {t('teams.quickContext.requests')}
            </p>
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
                      onClick={() => openRequest(request)}
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
          </div>
        ) : null}

        {notes.length > 0 ? (
          <QuickContextLinkTileGrid>
            <QuickContextLinkTile label={t('teams.quickContext.notes')} icon={StickyNote}>
              {t('teams.quickContext.noteCount', { count: notes.length })}
            </QuickContextLinkTile>
          </QuickContextLinkTileGrid>
        ) : null}

        {latestNote ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {t('teams.tabs.notes')}
            </p>
            <div className={DETAIL_NOTE_CALLOUT_CLASS}>
              <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                {latestNote}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/50 px-4 py-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-9 w-full text-xs"
          onClick={onOpenFullProfile}
        >
          {t('teams.quickContext.openFullProfile')}
        </Button>
      </div>
    </Card>
  );
}
