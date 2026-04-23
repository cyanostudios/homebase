import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import type { NavPage } from '@/core/ui/Sidebar';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onPageChange: (page: NavPage) => void;
}

export function Dashboard({ onPageChange }: DashboardProps) {
  const enabledPlugins = useEnabledPlugins();
  const { t } = useTranslation();

  const widgets = React.useMemo(
    () => PLUGIN_REGISTRY.filter((p) => enabledPlugins.has(p.name) && p.dashboardWidget),
    [enabledPlugins],
  );

  const pageHeader = (
    <div className="min-w-0">
      <h2 className="truncate text-xl font-semibold tracking-tight">{t('nav.dashboard')}</h2>
      <p className="text-sm text-muted-foreground">{t('dashboard.description')}</p>
    </div>
  );

  if (widgets.length === 0) {
    return (
      <div className="min-h-full bg-background px-6 py-4">
        <div className="space-y-4">
          {pageHeader}
          <Card className="rounded-xl border-0 bg-card p-6 text-center text-muted-foreground shadow-sm">
            <p>{t('dashboard.noWidgets')}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-6 py-4">
      <div className="space-y-4">
        {pageHeader}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {widgets.map((plugin, index) => {
            const WidgetComponent = plugin.dashboardWidget!;
            const label = plugin.navigation?.label ?? plugin.name;
            const dotClassName = ['bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-orange-500'][
              index % 4
            ];
            return (
              <Card
                key={plugin.name}
                className={cn(
                  'relative flex min-h-[160px] cursor-pointer flex-col rounded-xl border-0 bg-card p-4 shadow-sm transition-shadow',
                  'hover:shadow-md',
                  `plugin-${plugin.name} hover:plugin-${plugin.name}`,
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                tabIndex={0}
                role="button"
                aria-label={label}
                onClick={() => onPageChange(plugin.name as NavPage)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPageChange(plugin.name as NavPage);
                  }
                }}
              >
                <div className="mb-2 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                  <span
                    className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClassName)}
                    aria-hidden
                  />
                  <span className="line-clamp-1">{label}</span>
                </div>
                <div
                  className="flex min-h-0 flex-1 flex-col border-t border-border/50 pt-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <React.Suspense fallback={null}>
                    <WidgetComponent onOpenPlugin={() => onPageChange(plugin.name as NavPage)} />
                  </React.Suspense>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
