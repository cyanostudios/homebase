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
  formatSubmittedDateWithAge,
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

  return (
    <Card
      className={cn(
        'plugin-requests relative flex h-full min-h-[160px] cursor-pointer flex-col gap-3 rounded-xl border-0 bg-white p-5 shadow-sm transition-all dark:bg-slate-950',
        selected
          ? 'bg-plugin-subtle ring-1 border-plugin-subtle ring-plugin-subtle/50'
          : 'hover:border-plugin-subtle hover:shadow-md',
        highlighted && 'bg-green-50 dark:bg-green-950/30',
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
      <div className="flex items-center justify-between gap-2">
        {checkbox}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge className={REQUEST_STATUS_COLORS[request.status]}>
            {formatRequestStatusForDisplay(request.status, t)}
          </Badge>
          <Badge className={REQUEST_PRIORITY_COLORS[request.priority]}>{request.priority}</Badge>
        </div>
      </div>

      <h3 className="line-clamp-2 text-base font-semibold leading-snug">{request.title}</h3>

      <div className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
        <div className="truncate font-medium text-foreground/80">
          {getTypeLabel(request.requestType, t)}
          {teamName ? ` · ${teamName}` : ''}
        </div>
        {request.submitterName && (
          <div className="truncate">
            {t('requests.view.submitter')}: {request.submitterName}
          </div>
        )}
        {request.source === 'external' && (
          <Badge
            variant="outline"
            className={cn(
              'w-fit border-transparent text-[10px] font-medium',
              REQUEST_SOURCE_COLORS.external,
            )}
          >
            {t('requests.sourceExternal')}
          </Badge>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1 text-[10px] leading-snug text-muted-foreground">
        <div>
          Updated: {request.updated_at ? new Date(request.updated_at).toLocaleDateString() : '—'}
        </div>
        <div>
          {t('requests.view.submittedOn')}:{' '}
          {formatSubmittedDateWithAge(request.created_at, t) ?? '—'}
        </div>
      </div>
    </Card>
  );
}
