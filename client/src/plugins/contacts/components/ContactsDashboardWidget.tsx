import { ChevronRight } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import type { DashboardWidgetProps } from '@/core/pluginRegistry';
import { useContacts } from '@/plugins/contacts/hooks/useContacts';

export function ContactsDashboardWidget({ onOpenPlugin }: DashboardWidgetProps) {
  const { contacts } = useContacts();

  const privateCount = contacts.filter((c) => c.contactType === 'private').length;
  const companyCount = contacts.filter((c) => c.contactType === 'company').length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Antal kontakter i systemet: <strong>{contacts.length}</strong>
        <br />
        <span className="text-muted-foreground">
          {privateCount} privat, {companyCount} företag
        </span>
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
        Öppna Contacts
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
