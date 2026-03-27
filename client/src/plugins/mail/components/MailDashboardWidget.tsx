import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useMail } from '@/plugins/mail/hooks/useMail';

export function MailDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { mailHistory } = useMail();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Skickade mail: <strong>{mailHistory.length}</strong>
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
        Öppna Mail
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
