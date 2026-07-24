import { Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DETAIL_VIEW_CARD_CLASS } from '@/core/ui/detailViewCardStyles';
import { htmlToPlainTextWithBreaks } from '@/core/utils/textUtils';
import { cn } from '@/lib/utils';

import type { Request, RequestStatus } from '../types/requests';
import { REQUEST_PRIORITY_COLORS, REQUEST_SOURCE_COLORS, getTypeLabel } from '../types/requests';

import { RequestStatusSelect } from './RequestStatusSelect';

const BADGE_CLASS = 'border-0 rounded-md px-2 py-0.5 text-xs font-semibold';

function truncateContent(content: string, maxLength = 150): string {
  const plain = htmlToPlainTextWithBreaks(content);
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.substring(0, maxLength)}…`;
}

export function RequestListItem({
  request,
  selected,
  highlighted,
  onClick,
  checkbox,
  teamName,
  assignedNames = [],
  onStatusChange,
}: {
  request: Request;
  selected?: boolean;
  highlighted?: boolean;
  onClick: () => void;
  checkbox?: React.ReactNode;
  teamName?: string | null;
  assignedNames?: string[];
  onStatusChange: (status: RequestStatus) => void;
}) {
  const { t } = useTranslation();
  const excerpt = request.description ? truncateContent(request.description) : '';
  const updatedLabel = request.updated_at
    ? new Date(request.updated_at).toLocaleDateString()
    : null;
  const typeLabel = getTypeLabel(request.requestType, t);

  const openOnKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden p-0 transition-all',
        DETAIL_VIEW_CARD_CLASS,
        highlighted && 'bg-green-50 dark:bg-green-950/30',
        selected ? 'bg-plugin-subtle ring-1 border-plugin-subtle' : 'hover:shadow-md',
      )}
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'input[type="checkbox"], button, [role="combobox"], [data-radix-collection-item]',
          )
        ) {
          return;
        }
        onClick();
      }}
      onKeyDown={openOnKeyDown}
      data-list-item={JSON.stringify(request)}
      data-plugin-name="requests"
      role="button"
      tabIndex={0}
      aria-label={`Open request ${request.title}`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {checkbox}
            <Badge variant="outline" className={cn(BADGE_CLASS, 'bg-muted text-muted-foreground')}>
              {typeLabel}
            </Badge>
            <Badge
              variant="outline"
              className={cn(BADGE_CLASS, REQUEST_PRIORITY_COLORS[request.priority])}
            >
              {request.priority}
            </Badge>
            {request.source === 'external' ? (
              <Badge variant="outline" className={cn(BADGE_CLASS, REQUEST_SOURCE_COLORS.external)}>
                {t('requests.sourceExternal')}
              </Badge>
            ) : null}
          </div>
          <div
            className="flex shrink-0 justify-end"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <RequestStatusSelect
              request={request}
              onStatusChange={onStatusChange}
              hideInlineLabel
              compact
            />
          </div>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {request.title}
        </h3>

        {excerpt ? (
          <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
            {excerpt}
          </p>
        ) : null}

        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs text-muted-foreground">
          {teamName ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{teamName}</span>
            </span>
          ) : null}
          {assignedNames.length > 0 ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{assignedNames.join(', ')}</span>
            </span>
          ) : null}
          {updatedLabel ? (
            <span className="truncate">
              {t('common.updated')}: {updatedLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
