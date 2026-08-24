import { CalendarDays, CheckSquare, Inbox, Store, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { NavPage } from '@/core/navigation/navTypes';

import type { DashboardSectionProps } from './dashboardTypes';

interface QuickAction {
  plugin: NavPage;
  labelKey: string;
  icon: typeof Inbox;
}

const QUICK_ACTIONS: QuickAction[] = [
  { plugin: 'requests', labelKey: 'dashboard.actions.requests', icon: Inbox },
  { plugin: 'tasks', labelKey: 'dashboard.actions.tasks', icon: CheckSquare },
  { plugin: 'matches', labelKey: 'dashboard.actions.matches', icon: Trophy },
  { plugin: 'schedule', labelKey: 'dashboard.actions.schedule', icon: CalendarDays },
  { plugin: 'slots', labelKey: 'dashboard.actions.slots', icon: Store },
];

export function DashboardQuickActions({ has, onPageChange }: DashboardSectionProps) {
  const { t } = useTranslation();
  const actions = QUICK_ACTIONS.filter((action) => has(action.plugin));

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {t('dashboard.quickActions')}
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map(({ plugin, labelKey, icon: Icon }) => (
          <button
            key={plugin}
            type="button"
            onClick={() => onPageChange(plugin)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Icon className="h-3.5 w-3.5" />
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
