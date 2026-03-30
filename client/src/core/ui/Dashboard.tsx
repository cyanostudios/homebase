import React from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import type { NavPage } from '@/core/ui/Sidebar';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onPageChange: (page: NavPage) => void;
}

export function Dashboard({ onPageChange }: DashboardProps) {
  const { user } = useApp();
  const { t } = useTranslation();

  const header = (
    <div className="flex flex-shrink-0 items-center justify-between px-6 py-4">
      <div className="mr-4 min-w-0 flex flex-1 items-center gap-4">
        <h2 className="truncate shrink-0 text-lg font-semibold tracking-tight">
          {t('nav.dashboard')}
        </h2>
      </div>
    </div>
  );

  const widgets = React.useMemo(
    () => PLUGIN_REGISTRY.filter((p) => user?.plugins?.includes(p.name) && p.dashboardWidget),
    [user?.plugins],
  );

  if (widgets.length === 0) {
    return (
      <div className="min-h-full bg-background">
        {header}
        <div className="px-6 pb-6 space-y-4">
          <Card className="mt-4 border border-border/70 bg-card p-6 text-center text-muted-foreground shadow-sm">
            <p>{t('dashboard.noWidgets')}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      {header}
      <div className="px-6 pb-6 space-y-4">
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {widgets.map((plugin) => {
            const WidgetComponent = plugin.dashboardWidget!;
            const Icon = plugin.navigation?.icon;
            const label = plugin.navigation?.label ?? plugin.name;
            return (
              <Card
                key={plugin.name}
                className={cn(
                  'relative flex min-h-[160px] cursor-pointer flex-col border border-border/70 bg-card p-5 shadow-sm transition-all',
                  'hover:border-plugin-subtle hover:shadow-md',
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
                <div className="mb-3 flex min-w-0 items-start gap-2">
                  {Icon ? (
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-plugin" aria-hidden />
                  ) : null}
                  <h3 className="line-clamp-2 text-base font-semibold leading-tight">{label}</h3>
                </div>
                <div
                  className="flex min-h-0 flex-1 flex-col border-t border-border/60 pt-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <WidgetComponent onOpenPlugin={() => onPageChange(plugin.name as NavPage)} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
