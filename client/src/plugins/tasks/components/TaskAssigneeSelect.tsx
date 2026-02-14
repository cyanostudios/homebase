import React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';
import { cn } from '@/lib/utils';

interface TaskAssigneeSelectProps {
  task: any;
  onAssigneeChange: (contactId: string | null) => void;
}

export function TaskAssigneeSelect({ task, onAssigneeChange }: TaskAssigneeSelectProps) {
  const { contacts } = useApp();

  const currentContact = contacts.find((c: any) => String(c.id) === String(task.assignedTo));
  const displayValue = currentContact ? currentContact.companyName : 'Not assigned';

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        Assigned
      </div>
      <Select
        value={task.assignedTo ? String(task.assignedTo) : 'unassigned'}
        onValueChange={(val) => onAssigneeChange(val === 'unassigned' ? null : val)}
      >
        <SelectTrigger className="h-7 w-[120px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-[10px] font-medium">
          <SelectValue>
            <span className={cn('block truncate', !task.assignedTo && 'text-muted-foreground')}>
              {displayValue}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[200px]">
          <SelectItem
            value="unassigned"
            className="py-2 focus:bg-accent rounded-md text-[10px] text-muted-foreground"
          >
            Not assigned
          </SelectItem>
          {contacts
            .filter((contact: any) => contact.isAssignable !== false)
            .map((contact: any) => (
              <SelectItem
                key={contact.id}
                value={String(contact.id)}
                className="py-2 focus:bg-accent rounded-md text-[10px]"
              >
                {contact.companyName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
