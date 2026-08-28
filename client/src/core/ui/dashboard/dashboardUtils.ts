export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date);
  } catch {
    return '';
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('sv-SE', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

export { DONUT_CIRCUMFERENCE } from '@/core/ui/charts/chartConstants';

/** Max rows in compact dashboard list widgets (requests, tasks, upcoming matches). */
export const DASHBOARD_LIST_WIDGET_LIMIT = 5;

export function isActiveWorkStatus(status: string): boolean {
  return status === 'not started' || status === 'in progress';
}

/** Active requests newest-first, capped for dashboard widgets. */
export function selectActiveRequestsForDashboard<T extends { status: string; created_at: string }>(
  requests: T[],
  limit = DASHBOARD_LIST_WIDGET_LIMIT,
): T[] {
  return [...requests]
    .filter((r) => isActiveWorkStatus(r.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

/** Active tasks newest-first, capped for dashboard widgets. */
export function selectActiveTasksForDashboard<T extends { status: string; createdAt: Date }>(
  tasks: T[],
  limit = DASHBOARD_LIST_WIDGET_LIMIT,
): T[] {
  return [...tasks]
    .filter((t) => isActiveWorkStatus(t.status))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
