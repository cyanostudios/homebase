import React from 'react';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/core/api/AppContext';

interface TaskAssigneeSelectProps {
    task: any;
    onAssigneeChange: (contactId: string | null) => void;
}

export function TaskAssigneeSelect({ task, onAssigneeChange }: TaskAssigneeSelectProps) {
    const { contacts } = useApp();

    const currentContact = contacts.find((c: any) => c.id === task.assignedTo);
    const displayValue = currentContact ? currentContact.companyName : 'Not assigned';

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Assigned
            </div>
            <Select
                value={task.assignedTo || 'unassigned'}
                onValueChange={(val) => onAssigneeChange(val === 'unassigned' ? null : val)}
            >
                <SelectTrigger className="h-7 w-[160px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-[10px] font-medium">
                    <SelectValue>
                        <span className={!task.assignedTo ? 'text-muted-foreground italic' : ''}>
                            {displayValue}
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[200px]">
                    <SelectItem value="unassigned" className="py-2 focus:bg-accent rounded-md text-[10px] italic text-muted-foreground">
                        Not assigned
                    </SelectItem>
                    {contacts.map((contact: any) => (
                        <SelectItem key={contact.id} value={contact.id} className="py-2 focus:bg-accent rounded-md text-[10px]">
                            {contact.companyName}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
