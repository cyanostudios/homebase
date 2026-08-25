import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DashboardDataProps } from './dashboardTypes';
import { formatDateTime } from './dashboardUtils';

export function DashboardSidebar({ has, slots }: DashboardDataProps) {
  const { t } = useTranslation();
  const showSlots = has('slots');

  const upcomingSlots = useMemo(() => {
    const now = new Date();
    return slots
      .filter((slot) => slot.slot_time && new Date(slot.slot_time) > now)
      .sort((a, b) => new Date(a.slot_time).getTime() - new Date(b.slot_time).getTime())
      .slice(0, 5);
  }, [slots]);

  if (!showSlots) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {t('dashboard.bookableSlots')}
        </p>
        <div className="space-y-1">
          {upcomingSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/40"
            >
              {formatDateTime(slot.slot_time)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
