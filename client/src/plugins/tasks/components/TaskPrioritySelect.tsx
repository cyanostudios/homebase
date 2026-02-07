import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { TASK_PRIORITY_COLORS, TASK_PRIORITY_OPTIONS } from '../types/tasks';

interface TaskPrioritySelectProps {
    task: any;
    onPriorityChange: (priority: string) => void;
}

export function TaskPrioritySelect({ task, onPriorityChange }: TaskPrioritySelectProps) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Priority
            </div>
            <Select value={task.priority} onValueChange={onPriorityChange}>
                <SelectTrigger className="h-7 w-[120px] bg-background border-border/50 hover:bg-accent/50 transition-colors shadow-none rounded-md px-2">
                    <SelectValue placeholder="Select priority">
                        <Badge
                            variant="outline"
                            className={cn(
                                'border-transparent font-medium text-[10px] px-2 h-5 flex items-center',
                                TASK_PRIORITY_COLORS[task.priority as keyof typeof TASK_PRIORITY_COLORS],
                            )}
                        >
                            {task.priority}
                        </Badge>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-xl min-w-[180px]">
                    {TASK_PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority} value={priority} className="py-2 focus:bg-accent rounded-md">
                            <Badge
                                variant="outline"
                                className={cn(
                                    'border-transparent font-medium text-[10px] px-2 h-5',
                                    TASK_PRIORITY_COLORS[priority as keyof typeof TASK_PRIORITY_COLORS],
                                )}
                            >
                                {priority}
                            </Badge>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
