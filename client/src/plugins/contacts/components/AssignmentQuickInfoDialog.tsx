import { ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type AssignmentQuickInfoDetail = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
};

/** Preview popup for related team/task/slot rows (name click → info + open). */
export function AssignmentQuickInfoDialog({
  isOpen,
  title,
  icon: Icon,
  badges,
  details = [],
  openLabel,
  onOpen,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badges?: React.ReactNode;
  details?: AssignmentQuickInfoDetail[];
  openLabel: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6 flex-shrink-0 text-primary" />
            <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
              {details.length > 0 ? (
                <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                  {details.map((detail) => {
                    const DetailIcon = detail.icon;
                    return (
                      <div
                        key={`${detail.label}-${detail.value}`}
                        className="flex items-start gap-2"
                      >
                        <DetailIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {detail.label}
                          </div>
                          <div className="text-sm text-foreground">{detail.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel asChild>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="default" icon={ExternalLink} onClick={onOpen}>
              {openLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
