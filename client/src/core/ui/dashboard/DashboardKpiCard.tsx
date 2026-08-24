import { useTranslation } from 'react-i18next';

import type { NavPage } from '@/core/navigation/navTypes';

interface DashboardKpiCardProps {
  label: string;
  mainValue: number | string;
  subtext: string;
  pluginName: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function DashboardKpiCard({
  label,
  mainValue,
  subtext,
  pluginName,
  onPageChange,
}: DashboardKpiCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-950 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
        {mainValue}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{subtext}</p>
      <button
        type="button"
        onClick={() => onPageChange(pluginName)}
        className="mt-3 text-[10px] font-medium text-primary underline decoration-primary/40 hover:decoration-primary"
      >
        {t('dashboard.open')}
      </button>
    </div>
  );
}
