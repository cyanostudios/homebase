import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface TaskDueDatePickerProps {
    task: any;
    onDueDateChange: (date: Date | null) => void;
}

export function TaskDueDatePicker({ task, onDueDateChange }: TaskDueDatePickerProps) {
    const formatDateForInput = (date: any) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    const displayDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Set date';

    return (
        <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Due Date
            </div>
            <div className="relative w-[120px]">
                <Input
                    type="date"
                    value={formatDateForInput(task.dueDate)}
                    onChange={(e) => onDueDateChange(e.target.value ? new Date(e.target.value) : null)}
                    className="h-7 w-full bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2 text-[10px] font-medium opacity-0 absolute inset-0 z-10 cursor-pointer"
                />
                <div className="h-7 w-full flex items-center justify-between border border-border/50 bg-background rounded-md px-2 text-[10px] font-medium pointer-events-none transition-colors group-hover:bg-accent/50">
                    <span className={cn(!task.dueDate && "text-muted-foreground italic")}>
                        {displayDate}
                    </span>
                    <CalendarIcon className="w-3 h-3 text-muted-foreground opacity-50" />
                </div>
            </div>
        </div>
    );
}
