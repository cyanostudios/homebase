import { Users } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildSlug } from '@/core/utils/slugUtils';
import { useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';
import { cn } from '@/lib/utils';
import { useTeams } from '@/plugins/teams/hooks/useTeams';

import { buildTeamSlots, type ScheduleSlot } from '../types/schedule';

import { ScheduleWeekView } from './ScheduleWeekView';

export function ScheduleList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { teams } = useTeams();
  const { attemptNavigation } = useGlobalNavigationGuard();
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const weekSlots = useMemo(() => buildTeamSlots(teams, teamFilter), [teamFilter, teams]);

  const handleSlotClick = useCallback(
    (slot: ScheduleSlot) => {
      if (!slot.teamId) {
        return;
      }
      const team = teams.find((item) => String(item.id) === String(slot.teamId));
      if (!team) {
        return;
      }
      attemptNavigation(() => {
        navigate(`/teams/${buildSlug(team, teams, 'name')}`);
      });
    },
    [attemptNavigation, navigate, teams],
  );

  return (
    <div className="plugin-schedule min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.schedule')}</h2>
          <p className="text-sm text-muted-foreground">{t('schedule.listDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTeamFilter('all')}
            className={cn(
              'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
              'flex items-center gap-1.5 sm:gap-2',
              teamFilter === 'all'
                ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
            )}
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>
              {t('schedule.filterAll')}{' '}
              <span
                className={cn(
                  'tabular-nums font-semibold',
                  teamFilter === 'all'
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-primary',
                )}
              >
                ({teams.length})
              </span>
            </span>
          </Button>
          {teams.map((team) => {
            const isActive = teamFilter === String(team.id);
            return (
              <Button
                key={team.id}
                type="button"
                variant="ghost"
                onClick={() => setTeamFilter(isActive ? 'all' : String(team.id))}
                className={cn(
                  'group h-auto rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:px-5 sm:py-3 sm:text-sm',
                  'flex items-center gap-1.5 sm:gap-2',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary'
                    : 'border-transparent bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary',
                )}
              >
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="truncate">{team.name}</span>
              </Button>
            );
          })}
        </div>

        <Card className="rounded-xl border-0 bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {t('schedule.weeklySchedule')}
          </h3>
          <ScheduleWeekView slots={weekSlots} onSlotClick={handleSlotClick} />
        </Card>
      </div>
    </div>
  );
}
