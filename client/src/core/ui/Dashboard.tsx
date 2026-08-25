import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import type { NavPage } from '@/core/navigation/navTypes';
import { DashboardActivityPanel } from '@/core/ui/dashboard/DashboardActivityPanel';
import { DashboardChartsSection } from '@/core/ui/dashboard/DashboardChartsSection';
import { DashboardKpiSection } from '@/core/ui/dashboard/DashboardKpiSection';
import { DashboardQuickActions } from '@/core/ui/dashboard/DashboardQuickActions';
import { DashboardRequestsWidget } from '@/core/ui/dashboard/DashboardRequestsWidget';
import { DashboardSidebar } from '@/core/ui/dashboard/DashboardSidebar';
import { DashboardTasksWidget } from '@/core/ui/dashboard/DashboardTasksWidget';
import { DashboardTodaySchedule } from '@/core/ui/dashboard/DashboardTodaySchedule';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { useInvoices } from '@/plugins/invoices/hooks/useInvoices';
import { useMatches } from '@/plugins/matches/hooks/useMatches';
import { useRequests } from '@/plugins/requests/hooks/useRequests';
import { useSchedulePlans } from '@/plugins/schedule/hooks/useSchedulePlans';
import { useSlotsContext } from '@/plugins/slots/context/SlotsContext';
import { useTasks } from '@/plugins/tasks/hooks/useTasks';
import { useTeams } from '@/plugins/teams/hooks/useTeams';

interface DashboardProps {
  onPageChange: (page: NavPage) => void;
}

export function Dashboard({ onPageChange }: DashboardProps) {
  const enabledPlugins = useEnabledPlugins();
  const has = (name: string) => enabledPlugins.has(name);
  const { t } = useTranslation();

  const { tasks } = useTasks();
  const { requests } = useRequests();
  const { teams } = useTeams();
  const { matches } = useMatches();
  const { plans } = useSchedulePlans();
  const { invoices } = useInvoices();
  const { slots } = useSlotsContext();

  const showKpi = has('requests') || has('tasks') || has('matches') || has('teams');
  const showQuickActions =
    has('requests') || has('tasks') || has('matches') || has('schedule') || has('slots');
  const showActivity = has('matches') || (has('schedule') && has('teams'));
  const showSidebar = has('slots') || (has('schedule') && has('teams'));
  const showCharts = has('tasks') || has('invoices') || has('teams');
  const hasAnySection = showKpi || showQuickActions || showActivity || showSidebar || showCharts;

  const dataProps = {
    has,
    onPageChange,
    tasks,
    requests,
    teams,
    matches,
    plans,
    invoices,
    slots,
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-background px-4 pt-2 pb-4 md:px-6 md:py-4">
      <div className="mx-auto min-w-0 max-w-screen-2xl space-y-6">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.dashboard')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
        </div>

        {!hasAnySection ? (
          <Card className="rounded-md border-0 bg-white p-6 text-center text-muted-foreground shadow-none dark:bg-slate-950">
            <p>{t('dashboard.noWidgets')}</p>
          </Card>
        ) : (
          <>
            <DashboardKpiSection {...dataProps} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <DashboardQuickActions has={has} onPageChange={onPageChange} />
                <DashboardRequestsWidget {...dataProps} />
                <DashboardTasksWidget {...dataProps} />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <DashboardTodaySchedule {...dataProps} />
                  <DashboardActivityPanel {...dataProps} />
                </div>
                <DashboardSidebar {...dataProps} />
              </div>
            </div>

            <DashboardChartsSection {...dataProps} />
          </>
        )}
      </div>
    </div>
  );
}
