import { Search, Trophy, User, Users, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { DetailSection } from '@/core/ui/DetailSection';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { buildSlug } from '@/core/utils/slugUtils';
import {
  AssignmentQuickInfoDialog,
  type AssignmentQuickInfoDetail,
} from '@/plugins/contacts/components/AssignmentQuickInfoDialog';
import type { Team } from '@/plugins/teams/types/teams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

import { useRequests } from '../hooks/useRequests';
import { useRequestTeams } from '../hooks/useRequestTeams';

interface RequestAssignedTeamSelectProps {
  request: { teamId?: string | number | null };
  onTeamChange: (teamId: string | null) => void;
}

/**
 * Assigned-team picker: Contacts Linked-style tile + search-to-add (single team, same
 * pattern as Tasks). Tile click → team quick-info popup, then navigate on confirm.
 */
export function RequestAssignedTeamSelect({
  request,
  onTeamChange,
}: RequestAssignedTeamSelectProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const teams = useRequestTeams();
  const { closeRequestPanel } = useRequests();
  const [teamSearch, setTeamSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTeamQuickInfo, setShowTeamQuickInfo] = useState(false);

  const assignedTeamId =
    request?.teamId !== null &&
    request?.teamId !== undefined &&
    String(request.teamId).trim() !== ''
      ? String(request.teamId)
      : null;

  const assignedTeam = useMemo(
    () => (assignedTeamId ? teams.find((team) => String(team.id) === assignedTeamId) : null),
    [assignedTeamId, teams],
  );

  const assignedLabel = assignedTeam
    ? formatTeamLabel(assignedTeam) || `Team ${assignedTeam.id}`
    : null;

  const addableTeams = useMemo(() => {
    if (assignedTeamId) {
      return [];
    }
    return teams;
  }, [assignedTeamId, teams]);

  const filteredSuggestions = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) {
      return addableTeams;
    }
    return addableTeams.filter((team) => {
      const label = formatTeamLabel(team).toLowerCase();
      const name = (team.name ?? '').toLowerCase();
      const age = (team.age_group ?? '').toLowerCase();
      return label.includes(q) || name.includes(q) || age.includes(q);
    });
  }, [addableTeams, teamSearch]);

  const teamQuickInfoDetails = useMemo((): AssignmentQuickInfoDetail[] => {
    if (!assignedTeam) {
      return [];
    }
    const details: AssignmentQuickInfoDetail[] = [
      {
        icon: User,
        label: t('teams.form.statusLabel'),
        value: t(`teams.status.${assignedTeam.status}`),
      },
    ];
    if (assignedTeam.age_group?.trim()) {
      details.push({
        icon: Users,
        label: t('teams.form.ageGroupLabel'),
        value: assignedTeam.age_group.trim(),
      });
    }
    if (assignedTeam.gender) {
      details.push({
        icon: Users,
        label: t('teams.form.genderLabel'),
        value: t(`teams.gender.${assignedTeam.gender}`),
      });
    }
    if (assignedTeam.playing_format) {
      details.push({
        icon: Trophy,
        label: t('teams.form.playingFormatLabel'),
        value: assignedTeam.playing_format,
      });
    }
    return details;
  }, [assignedTeam, t]);

  const openPopover = showSuggestions && addableTeams.length > 0;
  const orphanLabel =
    assignedTeamId && !assignedTeam
      ? t('requests.assignedTeamOrphan', { id: assignedTeamId })
      : null;

  const openAssignedTeam = (team: Team) => {
    closeRequestPanel();
    setShowTeamQuickInfo(false);
    navigate(`/teams/${buildSlug(team, teams, 'name')}`);
  };

  const searchAction = (
    <Popover open={openPopover} onOpenChange={setShowSuggestions}>
      <PopoverAnchor asChild>
        <div className="relative w-full min-w-0 sm:max-w-[220px] sm:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={teamSearch}
            onChange={(event) => {
              setTeamSearch(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={
              assignedTeamId
                ? t('requests.assignedTeamReplaceHint')
                : addableTeams.length === 0
                  ? t('requests.noTeamsToAssign')
                  : t('requests.addAssignedTeamPlaceholder')
            }
            className="h-9 bg-background pl-9 text-xs"
            disabled={addableTeams.length === 0}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="z-[120] w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-xl"
      >
        {filteredSuggestions.length > 0 ? (
          filteredSuggestions.map((team) => {
            const label = formatTeamLabel(team) || `Team ${team.id}`;
            const meta = [
              team.gender ? t(`teams.gender.${team.gender}`) : null,
              team.playing_format,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <button
                key={team.id}
                type="button"
                className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-accent"
                onClick={() => {
                  onTeamChange(String(team.id));
                  setTeamSearch('');
                  setShowSuggestions(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{label}</span>
                  {meta ? (
                    <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
                  ) : null}
                </span>
              </button>
            );
          })
        ) : (
          <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
            {teamSearch.trim() ? t('common.noResults') : t('requests.addAssignedTeamPlaceholder')}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={
            <span className="inline-flex items-baseline gap-2">
              <span>{t('requests.assignedTeam')}</span>
              <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                {t('requests.quickContext.mentionsHint')}
              </span>
            </span>
          }
          icon={Users}
          iconPlugin="teams"
          subtleTitle
          className="p-6"
          action={searchAction}
        >
          {assignedTeam || orphanLabel ? (
            <QuickContextLinkTileGrid>
              <div className="group relative min-w-0">
                <QuickContextLinkTile
                  label={t('nav.team')}
                  meta={
                    assignedTeam?.playing_format
                      ? String(assignedTeam.playing_format)
                      : assignedTeam?.gender
                        ? t(`teams.gender.${assignedTeam.gender}`)
                        : null
                  }
                  icon={Users}
                  iconClassName="text-emerald-600"
                  onClick={assignedTeam ? () => setShowTeamQuickInfo(true) : undefined}
                >
                  {assignedTeam ? assignedLabel : orphanLabel}
                </QuickContextLinkTile>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={X}
                  className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTeamChange(null);
                  }}
                  aria-label={t('requests.removeAssignedTeam')}
                />
              </div>
            </QuickContextLinkTileGrid>
          ) : (
            <p className="text-xs text-muted-foreground">{t('requests.noAssignedTeamYet')}</p>
          )}
        </DetailSection>
      </Card>

      <AssignmentQuickInfoDialog
        isOpen={showTeamQuickInfo && assignedTeam !== null}
        title={assignedLabel || assignedTeam?.name || ''}
        icon={Users}
        details={teamQuickInfoDetails}
        openLabel={t('contacts.openTeam')}
        onClose={() => setShowTeamQuickInfo(false)}
        onOpen={() => {
          if (assignedTeam) {
            openAssignedTeam(assignedTeam);
          }
        }}
      />
    </>
  );
}
