import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';

import { useAIProviders } from '../hooks/useAIProviders';

export function AIProvidersDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { providers } = useAIProviders();

  const enabledCount = useMemo(
    () => providers.filter((provider) => provider.enabled).length,
    [providers],
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal leverantörer: <strong>{providers.length}</strong>
        <br />
        <span className="text-muted-foreground">{enabledCount} aktiverade</span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/90"
        onClick={(e) => {
          e.stopPropagation();
          onOpenPlugin();
        }}
      >
        Öppna AI Providers
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
