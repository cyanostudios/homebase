import { CalendarClock, CalendarDays, Clock, ExternalLink, MapPin, Pencil } from 'lucide-react';
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
import {
  AlertDialogRoundAction,
  AlertDialogRoundCancel,
  DialogActionButton,
} from '@/core/ui/DialogRoundButtons';
import { useTeamVenues } from '@/plugins/teams/hooks/useTeamVenues';
import { resolveTrainingLocation } from '@/plugins/teams/utils/resolveTrainingLocation';

import { slotCountsTowardCapacity, type ScheduleSlot } from '../types/schedule';

export function ScheduleSlotDetailDialog({
  isOpen,
  slot,
  isLocked,
  onClose,
  onEdit,
  onNavigateToTeam,
}: {
  isOpen: boolean;
  slot: ScheduleSlot | null;
  isLocked: boolean;
  onClose: () => void;
  onEdit?: (slot: ScheduleSlot) => void;
  onNavigateToTeam?: (slot: ScheduleSlot) => void;
}) {
  const { t } = useTranslation();
  const { venues } = useTeamVenues();

  if (!slot) {
    return null;
  }

  const timeLabel = slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
  const teamLabel = slot.teamId ? slot.teamName || slot.title : t('schedule.noTeam');
  const counts = slotCountsTowardCapacity(slot);
  const canEdit = !isLocked && Boolean(onEdit);
  const canGoToTeam = Boolean(slot.teamId && onNavigateToTeam);
  const resolvedLocation = resolveTrainingLocation(
    { location: slot.location, venueId: slot.venueId },
    venues,
  );

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <CalendarClock className="h-6 w-6 flex-shrink-0 text-primary" />
            <AlertDialogTitle className="text-left">{teamLabel}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3 pt-2">
              <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('schedule.slotDetail.time')}
                    </div>
                    <div className="text-sm tabular-nums text-foreground">{timeLabel}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t('schedule.slotDetail.day')}
                    </div>
                    <div className="text-sm text-foreground">
                      {t(`teams.days.${slot.day}`, { defaultValue: slot.day })}
                    </div>
                  </div>
                </div>

                {resolvedLocation.name ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('schedule.slotDetail.location')}
                      </div>
                      {resolvedLocation.mapUrl ? (
                        <a
                          href={resolvedLocation.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-plugin hover:underline"
                        >
                          {resolvedLocation.name}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <div className="text-sm text-foreground">{resolvedLocation.name}</div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-border/50 pt-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('schedule.countTowardCapacity')}
                  </div>
                  <div className="mt-0.5 text-sm text-foreground">
                    {counts ? t('common.yes') : t('common.no')}
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogRoundCancel close onClick={onClose} />
          {canEdit ? (
            <DialogActionButton
              type="button"
              variant="secondary"
              icon={Pencil}
              label={t('schedule.slotDetail.edit')}
              onClick={() => {
                onEdit?.(slot);
                onClose();
              }}
            />
          ) : null}
          {canGoToTeam ? (
            <AlertDialogRoundAction
              icon={ExternalLink}
              label={t('schedule.slotDetail.goToTeam')}
              onClick={() => {
                onNavigateToTeam?.(slot);
                onClose();
              }}
            />
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
