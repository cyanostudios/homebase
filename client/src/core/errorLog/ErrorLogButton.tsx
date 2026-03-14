import { AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useErrorLog } from './ErrorLogContext';
import type { ApiErrorEntry } from './apiErrorStore';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function ErrorRow({ entry }: { entry: ApiErrorEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    entry.url || entry.status != null || entry.method || (entry.body && entry.body.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border last:border-0 py-2 first:pt-0 last:pb-0">
        <CollapsibleTrigger asChild disabled={!hasDetails}>
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
          >
            <span className="flex-1 truncate text-sm">{entry.message}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(entry.timestamp)}
            </span>
            {hasDetails && (
              <span className="shrink-0 text-muted-foreground text-xs">
                {open ? '▼' : '▶'}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded bg-muted/50 p-2 text-xs font-mono space-y-1">
            {entry.url && <div>URL: {entry.url}</div>}
            {entry.status != null && (
              <div>
                Status: {entry.status} {entry.statusText || ''}
              </div>
            )}
            {entry.method && <div>Method: {entry.method}</div>}
            {entry.body && (
              <div className="break-all whitespace-pre-wrap">Body: {entry.body}</div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function ErrorLogButton() {
  const { entries, count, clear } = useErrorLog();
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-1.5">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <Badge variant="destructive" className="shrink-0">
            {count}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(400px,90vw)] p-0">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium">API errors ({count})</h3>
        </div>
        <ScrollArea className="h-[min(320px,50vh)]">
          <div className="p-4 space-y-0">
            {entries.map((e) => (
              <ErrorRow key={e.id} entry={e} />
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 border-t p-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              clear();
              setOpen(false);
            }}
          >
            Clear and Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
