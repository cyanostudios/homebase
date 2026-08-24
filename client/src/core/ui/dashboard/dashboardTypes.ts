import type { NavPage } from '@/core/navigation/navTypes';
import type { Invoice } from '@/plugins/invoices/context/InvoicesContext';
import type { Match } from '@/plugins/matches/types/match';
import type { Request } from '@/plugins/requests/types/requests';
import type { SchedulePlan } from '@/plugins/schedule/types/schedule';
import type { Slot } from '@/plugins/slots/types/slots';
import type { Task } from '@/plugins/tasks/types/tasks';
import type { Team } from '@/plugins/teams/types/teams';

export interface DashboardSectionProps {
  has: (name: string) => boolean;
  onPageChange: (page: NavPage) => void;
}

export interface DashboardDataProps extends DashboardSectionProps {
  tasks: Task[];
  requests: Request[];
  teams: Team[];
  matches: Match[];
  plans: SchedulePlan[];
  invoices: Invoice[];
  slots: Slot[];
}
