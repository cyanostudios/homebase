import { AlertCircle, CheckCircle2 } from 'lucide-react';
import React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type CupIngestImportResultVariant = 'success' | 'partial' | 'error';

export interface CupIngestImportResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: CupIngestImportResultVariant;
  title?: string;
  sourceCount?: number;
  parsed?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  softDeleted?: number;
  hardDeleted?: number;
  errors?: string[];
}

export function CupIngestImportResultDialog({
  isOpen,
  onClose,
  variant = 'success',
  title,
  sourceCount,
  parsed = 0,
  created = 0,
  updated = 0,
  skipped = 0,
  softDeleted = 0,
  hardDeleted = 0,
  errors = [],
}: CupIngestImportResultDialogProps) {
  const resolvedTitle =
    title ??
    (variant === 'error'
      ? 'Import failed'
      : variant === 'partial'
        ? 'Import finished with issues'
        : 'Import complete');

  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  const iconClass =
    variant === 'success'
      ? 'text-green-600 dark:text-green-400'
      : variant === 'partial'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-destructive';

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <Icon className={cn('h-6 w-6 shrink-0 mt-0.5', iconClass)} aria-hidden />
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle className="text-left">{resolvedTitle}</AlertDialogTitle>
              {sourceCount !== null && sourceCount !== undefined && sourceCount > 0 && (
                <p className="text-sm text-muted-foreground text-left">
                  {sourceCount} ingest source{sourceCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2 text-left text-foreground">
              <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm">
                <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                  <div>
                    <div className="text-xs text-muted-foreground">Parsed</div>
                    <div className="font-semibold tabular-nums">{parsed}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                      {created}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Updated</div>
                    <div className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                      {updated}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                    <div className="font-semibold tabular-nums">{skipped}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Removed</div>
                    <div
                      className={cn(
                        'font-semibold tabular-nums',
                        softDeleted > 0 && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {softDeleted}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Deleted</div>
                    <div className="font-semibold tabular-nums text-muted-foreground">
                      {hardDeleted}
                    </div>
                  </div>
                </div>
              </div>
              {errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Details</p>
                  <ScrollArea className="max-h-40 rounded-md border border-border/60 p-2">
                    <ul className="space-y-1 text-xs text-muted-foreground font-mono">
                      {errors.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button type="button" variant="primary" className="h-9 px-4 text-xs">
              OK
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
