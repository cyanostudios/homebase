import { ChevronRight, Shirt } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { garmentsApi } from '../api/garmentsApi';
import type { GarmentList } from '../types/garments';

interface TeamGarmentsSectionProps {
  teamId: string | number;
  compact?: boolean;
  onOpenList?: (list: GarmentList) => void;
}

export function TeamGarmentsSection({
  teamId,
  compact = false,
  onOpenList,
}: TeamGarmentsSectionProps) {
  const { t } = useTranslation();
  const [lists, setLists] = useState<GarmentList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    garmentsApi
      .getLists(String(teamId))
      .then((data) => {
        if (!cancelled) {
          setLists(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLists([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Shirt className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('garments.noListsForTeam')}</p>
      </div>
    );
  }

  if (compact) {
    const first = lists[0];
    return (
      <button
        type="button"
        onClick={() => onOpenList?.(first)}
        disabled={!onOpenList}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3 text-left',
          onOpenList && 'cursor-pointer transition-opacity hover:opacity-80',
          !onOpenList && 'cursor-default',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('nav.garments')}
          </p>
          <p className="truncate text-sm font-medium">{first.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t('garments.personCount', {
              count: first.personCount ?? first.persons?.length ?? 0,
            })}
          </p>
        </div>
        {onOpenList ? (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : null}
      </button>
    );
  }

  return (
    <ul className="space-y-2">
      {lists.map((list) => (
        <li key={list.id}>
          <button
            type="button"
            onClick={() => onOpenList?.(list)}
            disabled={!onOpenList}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-3 text-left',
              onOpenList && 'cursor-pointer transition-opacity hover:opacity-80',
              !onOpenList && 'cursor-default',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{list.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t('garments.personCount', {
                  count: list.personCount ?? list.persons?.length ?? 0,
                })}
              </p>
            </div>
            {onOpenList ? (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
