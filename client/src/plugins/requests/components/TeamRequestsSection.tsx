import { ChevronRight, Inbox, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { requestsApi } from '../api/requestsApi';
import type { Request, RequestPriority, RequestStatus } from '../types/requests';
import { formatSubmittedDateWithAge, getTypeLabel } from '../types/requests';

import { RequestPrioritySelect } from './RequestPrioritySelect';
import { RequestStatusSelect } from './RequestStatusSelect';

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

interface TeamRequestsSectionProps {
  teamId: string | number;
  compact?: boolean;
  onOpenRequest?: (request: Request) => void;
  onCreateRequest?: () => void;
}

export function TeamRequestsSection({
  teamId,
  compact = false,
  onOpenRequest,
  onCreateRequest,
}: TeamRequestsSectionProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    requestsApi
      .getRequests({ team_id: Number(teamId) })
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const handleStatusChange = useCallback(async (request: Request, newStatus: RequestStatus) => {
    const previousStatus = request.status;
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: newStatus } : r)));
    try {
      const updated = await requestsApi.updateRequest(request.id, {
        title: request.title,
        status: newStatus,
      });
      setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)));
    } catch (error) {
      console.error('Failed to update request status:', error);
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status: previousStatus } : r)),
      );
    }
  }, []);

  const handlePriorityChange = useCallback(
    async (request: Request, newPriority: RequestPriority) => {
      const previousPriority = request.priority;
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, priority: newPriority } : r)),
      );
      try {
        const updated = await requestsApi.updateRequest(request.id, {
          title: request.title,
          priority: newPriority,
        });
        setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)));
      } catch (error) {
        console.error('Failed to update request priority:', error);
        setRequests((prev) =>
          prev.map((r) => (r.id === request.id ? { ...r, priority: previousPriority } : r)),
        );
      }
    },
    [],
  );

  const displayRequests = compact ? requests.slice(0, 5) : requests;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('requests.noYetForTeam')}</p>
        {onCreateRequest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={onCreateRequest}
            className="mt-1"
          >
            {t('requests.addRequest')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {displayRequests.map((request) => {
        const submittedDate = formatSubmittedDateWithAge(request.created_at, t);
        return (
          <div
            key={request.id}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
          >
            <button
              type="button"
              onClick={() => onOpenRequest?.(request)}
              disabled={!onOpenRequest}
              className={cn(
                'min-w-0 flex-1 text-left',
                onOpenRequest && 'cursor-pointer transition-opacity hover:opacity-80',
                !onOpenRequest && 'cursor-default',
              )}
            >
              <p className="truncate text-sm font-medium">{request.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {getTypeLabel(request.requestType, t)}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <span className="text-foreground/80">{getSubmitterDisplay(request, t)}</span>
                {submittedDate ? (
                  <>
                    <span className="mx-1 text-muted-foreground/50">·</span>
                    <span>
                      {t('requests.teamRow.submitted')} {submittedDate}
                    </span>
                  </>
                ) : null}
              </p>
            </button>

            <div
              className="flex flex-shrink-0 items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <RequestPrioritySelect
                request={request}
                onPriorityChange={(priority) => void handlePriorityChange(request, priority)}
                hideInlineLabel
                compact
              />
              <RequestStatusSelect
                request={request}
                onStatusChange={(status) => void handleStatusChange(request, status)}
                hideInlineLabel
                compact
              />
              {onOpenRequest && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
        );
      })}

      {compact && requests.length > 5 && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          {t('requests.moreCount', { count: requests.length - 5 })}
        </p>
      )}

      {!compact && onCreateRequest && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Plus}
          onClick={onCreateRequest}
          className="mt-2"
        >
          {t('requests.addRequest')}
        </Button>
      )}
    </div>
  );
}
