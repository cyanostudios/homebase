import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  REQUEST_STATUS_COLORS,
  formatRequestStatusForDisplay,
  getTypeLabel,
} from '@/plugins/requests/types/requests';

import type { DashboardDataProps } from './dashboardTypes';
import { selectActiveRequestsForDashboard } from './dashboardUtils';

export function DashboardRequestsWidget({ has, requests }: DashboardDataProps) {
  const { t } = useTranslation();

  const visible = selectActiveRequestsForDashboard(requests);

  if (!has('requests')) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.openRequests')}
      </p>
      {visible.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{t('dashboard.noOpenRequests')}</p>
      ) : (
        <div className="space-y-1">
          {visible.map((request) => (
            <div
              key={request.id}
              className="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'h-5 shrink-0 border-transparent px-1.5 text-[10px] font-extrabold',
                    REQUEST_STATUS_COLORS[request.status],
                  )}
                >
                  {formatRequestStatusForDisplay(request.status, t)}
                </Badge>
                <span className="min-w-0 truncate font-medium text-foreground">
                  {request.title}
                </span>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {getTypeLabel(request.requestType, t)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
