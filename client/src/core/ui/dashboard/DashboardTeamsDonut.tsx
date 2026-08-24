import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Team } from '@/plugins/teams/types/teams';
import { isTeamOnBreak } from '@/plugins/teams/types/teams';

import { DONUT_CIRCUMFERENCE } from './dashboardUtils';

interface DashboardTeamsDonutProps {
  teams: Team[];
}

export function DashboardTeamsDonut({ teams }: DashboardTeamsDonutProps) {
  const { t } = useTranslation();

  const { activeCount, breakCount, dormantCount } = useMemo(() => {
    let active = 0;
    let breakTeamCount = 0;
    let dormant = 0;
    for (const team of teams) {
      if (isTeamOnBreak(team)) {
        breakTeamCount += 1;
      } else if (team.status === 'dormant') {
        dormant += 1;
      } else if (team.status === 'active') {
        active += 1;
      }
    }
    return { activeCount: active, breakCount: breakTeamCount, dormantCount: dormant };
  }, [teams]);

  const total = teams.length || 1;
  const circ = DONUT_CIRCUMFERENCE;
  const activeArc = (activeCount / total) * circ;
  const breakArc = (breakCount / total) * circ;
  const dormantArc = (dormantCount / total) * circ;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.teamStatus')}
      </p>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 80 80"
          className="h-20 w-20 shrink-0"
          role="img"
          aria-label={t('dashboard.aria.teamStatusChart')}
        >
          <g transform="rotate(-90 40 40)">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
              strokeDasharray={`${circ}`}
            />
            {activeArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={`${activeArc} ${circ}`}
                strokeDashoffset="0"
              />
            )}
            {breakArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#f97316"
                strokeWidth="8"
                strokeDasharray={`${breakArc} ${circ}`}
                strokeDashoffset={`${-activeArc}`}
              />
            )}
            {dormantArc > 0 && (
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeDasharray={`${dormantArc} ${circ}`}
                strokeDashoffset={`${-(activeArc + breakArc)}`}
              />
            )}
          </g>
        </svg>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{t('dashboard.legend.active', { count: activeCount })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            <span>{t('dashboard.legend.onBreak', { count: breakCount })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{t('dashboard.legend.dormant', { count: dormantCount })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
