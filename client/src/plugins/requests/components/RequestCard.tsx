import { ChevronRight, Tag, User, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Request } from '../types/requests';
import {
  REQUEST_PRIORITY_COLORS,
  REQUEST_SOURCE_COLORS,
  REQUEST_STATUS_COLORS,
  formatRequestStatusForDisplay,
  formatSubmittedDate,
  formatDaysSinceSubmission,
  getDaysSinceSubmission,
  getRequestAgeAvatarColor,
  getTypeLabel,
} from '../types/requests';

export function RequestCard({
  request,
  selected,
  highlighted,
  onClick,
  checkbox,
  teamName,
}: {
  request: Request;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  teamName?: string | null;
}) {
  const { t } = useTranslation();
  const typeLabel = getTypeLabel(request.requestType, t);
  const submittedDate = formatSubmittedDate(request.created_at);
  const daysOld = getDaysSinceSubmission(request.created_at);
  const daysOldLabel = formatDaysSinceSubmission(request.created_at, t);

  return (
    <Card
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-sm transition-all dark:bg-slate-950',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
          return;
        }
        onClick();
      }}
      data-list-item={JSON.stringify(request)}
      data-plugin-name="requests"
      role="button"
      aria-label={`Open request ${request.title}`}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {checkbox}
            {daysOld !== null ? (
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  getRequestAgeAvatarColor(daysOld),
                )}
                title={daysOldLabel ?? undefined}
                aria-label={daysOldLabel ?? undefined}
              >
                <span
                  className={cn(
                    'font-bold tabular-nums leading-none',
                    daysOld >= 100 ? 'text-xs' : 'text-sm',
                  )}
                >
                  {daysOld}
                </span>
              </div>
            ) : null}
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{request.title}</h3>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                REQUEST_STATUS_COLORS[request.status],
              )}
            >
              {formatRequestStatusForDisplay(request.status, t)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate font-medium text-foreground/80">{typeLabel}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 truncate">{teamName || '—'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className={cn(
              'h-5 border-transparent px-2 text-[10px] font-medium',
              REQUEST_PRIORITY_COLORS[request.priority],
            )}
          >
            {request.priority}
          </Badge>
          {request.submitterName ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{request.submitterName}</span>
            </span>
          ) : null}
          {request.source === 'external' ? (
            <Badge
              variant="outline"
              className={cn(
                'h-5 border-transparent px-2 text-[10px] font-medium',
                REQUEST_SOURCE_COLORS.external,
              )}
            >
              {t('requests.sourceExternal')}
            </Badge>
          ) : null}
        </div>

        {submittedDate ? (
          <div className="mt-auto border-t border-border/60 pt-2.5">
            <span className="text-xs text-muted-foreground">
              {t('requests.view.submittedOn')}: {submittedDate}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
