import React from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import type { NavPage } from '@/core/ui/Sidebar';
import { cn } from '@/lib/utils';

interface DashboardProps {
  onPageChange: (page: NavPage) => void;
}

export function Dashboard({ onPageChange }: DashboardProps) {
  const { user } = useApp();

  const widgets = React.useMemo(
    () => PLUGIN_REGISTRY.filter((p) => user?.plugins?.includes(p.name) && p.dashboardWidget),
    [user?.plugins],
  );

  if (widgets.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p>Inga widgets tillgängliga. Aktivera plugins för att se widgetar här.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {widgets.map((plugin) => {
        const WidgetComponent = plugin.dashboardWidget!;
        const Icon = plugin.navigation?.icon;
        return (
          <Card
            key={plugin.name}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-md border-transparent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              `plugin-${plugin.name} bg-plugin-subtle border-plugin-subtle hover:border-plugin-subtle/50`
            )}
            tabIndex={0}
            role="button"
            onClick={() => onPageChange(plugin.name as NavPage)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPageChange(plugin.name as NavPage);
              }
            }}
          >
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              {Icon && <Icon className="h-5 w-5 text-plugin" aria-hidden />}
              <span className="font-medium">{plugin.navigation?.label ?? plugin.name}</span>
            </CardHeader>
            <CardContent
              className="pt-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <WidgetComponent onOpenPlugin={() => onPageChange(plugin.name as NavPage)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
