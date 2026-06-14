import { CalendarDays, ExternalLink, MapPin, Trophy } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { formatMatchDateTime, formatMatchScore, type Match } from '@/plugins/matches/types/match';

import { MatchStatusBadges } from './MatchStatusBadges';

export function MatchQuickInfoDialog({
  isOpen,
  match,
  onOpenMatch,
  onClose,
}: {
  isOpen: boolean;
  match: Match | null;
  onOpenMatch: () => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();

  if (!match) {
    return null;
  }

  const scoreLabel = formatMatchScore(match);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 flex-shrink-0 text-primary" />
            <AlertDialogTitle className="text-left">
              {match.home_team} – {match.away_team}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <MatchStatusBadges match={match} />

              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('matches.dateLabel')}
                    </div>
                    <div className="text-sm text-foreground">
                      {formatMatchDateTime(match.start_time, i18n.language, {
                        weekday: 'long',
                        month: 'long',
                      }) || '—'}
                    </div>
                  </div>
                </div>

                {match.location?.trim() ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('matches.locationLabel')}
                      </div>
                      <div className="text-sm text-foreground">{match.location}</div>
                    </div>
                  </div>
                ) : null}

                {match.competition_name?.trim() ? (
                  <div className="flex items-start gap-2">
                    <Trophy className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('matches.competitionName')}
                      </div>
                      <div className="text-sm text-foreground">{match.competition_name}</div>
                    </div>
                  </div>
                ) : null}

                {scoreLabel ? (
                  <div className="border-t border-border/50 pt-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('matches.result')}
                    </div>
                    <div
                      className={cn('mt-0.5 text-lg font-semibold tabular-nums text-foreground')}
                    >
                      {scoreLabel}
                    </div>
                  </div>
                ) : null}
              </div>
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
            <Button variant="default" icon={ExternalLink} onClick={onOpenMatch}>
              {t('matches.openMatch')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
