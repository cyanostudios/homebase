import { CalendarDays, ExternalLink, Inbox, Mail, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogRoundAction, AlertDialogRoundCancel } from '@/core/ui/DialogRoundButtons';
import { cn } from '@/lib/utils';

import {
  formatRequestStatusForDisplay,
  formatSubmittedDateWithAge,
  getTypeLabel,
  REQUEST_PRIORITY_COLORS,
  REQUEST_STATUS_COLORS,
  type Request,
} from '../types/requests';

function getSubmitterDisplay(request: Request, t: (key: string) => string): string {
  const name = request.submitterName?.trim();
  if (name) {
    return name;
  }
  const email = request.submitterEmail?.trim();
  if (email) {
    return email;
  }
  return t('requests.teamRow.unknownSubmitter');
}

/** Preview popup before opening a request (same pattern as MatchQuickInfoDialog). */
export function RequestQuickInfoDialog({
  isOpen,
  request,
  onOpenRequest,
  onClose,
}: {
  isOpen: boolean;
  request: Request | null;
  onOpenRequest: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  if (!request) {
    return null;
  }

  const submitted = formatSubmittedDateWithAge(request.created_at, t);
  const email = request.submitterEmail?.trim();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 flex-shrink-0 text-primary" />
            <AlertDialogTitle className="text-left">{request.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                    REQUEST_STATUS_COLORS[request.status],
                  )}
                >
                  {formatRequestStatusForDisplay(request.status, t)}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                    REQUEST_PRIORITY_COLORS[request.priority],
                  )}
                >
                  {request.priority}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {getTypeLabel(request.requestType, t)}
                </span>
              </div>

              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('requests.form.submitter')}
                    </div>
                    <div className="text-sm text-foreground">{getSubmitterDisplay(request, t)}</div>
                  </div>
                </div>

                {email ? (
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('requests.form.submitterEmail')}
                      </div>
                      <a
                        href={`mailto:${email}`}
                        className="text-sm text-foreground hover:text-plugin hover:underline"
                      >
                        {email}
                      </a>
                    </div>
                  </div>
                ) : null}

                {submitted ? (
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('requests.view.submittedOn')}
                      </div>
                      <div className="text-sm text-foreground">{submitted}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogRoundCancel close onClick={onClose} />
          <AlertDialogRoundAction
            icon={ExternalLink}
            label={t('requests.openRequest')}
            onClick={onOpenRequest}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
