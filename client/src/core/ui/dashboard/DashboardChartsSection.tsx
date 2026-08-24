import { DashboardInvoicesBar } from './DashboardInvoicesBar';
import { DashboardTasksDonut } from './DashboardTasksDonut';
import { DashboardTeamsDonut } from './DashboardTeamsDonut';
import type { DashboardDataProps } from './dashboardTypes';

export function DashboardChartsSection({ has, tasks, invoices, teams }: DashboardDataProps) {
  const showTasks = has('tasks');
  const showInvoices = has('invoices');
  const showTeams = has('teams');

  if (!showTasks && !showInvoices && !showTeams) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {showTasks && <DashboardTasksDonut tasks={tasks} />}
      {showInvoices && <DashboardInvoicesBar invoices={invoices} />}
      {showTeams && <DashboardTeamsDonut teams={teams} />}
    </div>
  );
}
