import { Search, Trash2, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { useTeams } from '@/plugins/teams/hooks/useTeams';
import { formatTeamLabel } from '@/plugins/teams/utils/formatTeamLabel';

interface TaskAssignedTeamSelectProps {
  task: { teamId?: string | null };
  onTeamChange: (teamId: string | null) => void;
}

/**
 * Assigned-team picker matching TaskAssigneeSelect: header + Popover search + removable row.
 * Single team only (replacing requires remove first).
 */
export function TaskAssignedTeamSelect({ task, onTeamChange }: TaskAssignedTeamSelectProps) {
  const { t } = useTranslation();
  const { teams } = useTeams();
  const [teamSearch, setTeamSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const assignedTeamId =
    task?.teamId !== null && task?.teamId !== undefined && String(task.teamId).trim() !== ''
      ? String(task.teamId)
      : null;

  const assignedTeam = useMemo(
    () => (assignedTeamId ? teams.find((team) => String(team.id) === assignedTeamId) : null),
    [assignedTeamId, teams],
  );

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

  const openPopover = showSuggestions && addableTeams.length > 0;
  const orphanLabel =
    assignedTeamId && !assignedTeam ? t('tasks.assignedTeamOrphan', { id: assignedTeamId }) : null;

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <div className="space-y-2 p-6">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {t('tasks.assignedTeam')}
            </span>
          </div>
          <Popover open={openPopover} onOpenChange={setShowSuggestions}>
            <PopoverAnchor asChild>
              <div className="relative w-full min-w-0 sm:max-w-[260px] sm:shrink-0">
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
                      ? t('tasks.assignedTeamReplaceHint')
                      : addableTeams.length === 0
                        ? t('tasks.noTeamsToAssign')
                        : t('tasks.addAssignedTeamPlaceholder')
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
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  {teamSearch.trim()
                    ? t('common.noResults')
                    : t('tasks.addAssignedTeamPlaceholder')}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {(assignedTeam || orphanLabel) && (
          <div className="space-y-2 pt-0.5">
            <div className="rounded-lg border border-border p-4">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {assignedTeam
                        ? formatTeamLabel(assignedTeam) || `Team ${assignedTeam.id}`
                        : orphanLabel}
                    </span>
                  </div>
                  {assignedTeam?.age_group ? (
                    <div className="min-w-0 truncate text-xs text-muted-foreground">
                      {assignedTeam.age_group}
                      {assignedTeam.playing_format ? ` · ${assignedTeam.playing_format}` : ''}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    className="h-9 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => onTeamChange(null)}
                    aria-label={t('tasks.removeAssignedTeam')}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
