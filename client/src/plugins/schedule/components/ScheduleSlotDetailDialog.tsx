import { CalendarClock, CalendarDays, Clock, ExternalLink, MapPin, Pencil } from 'lucide-react';
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

  if (!slot) {
    return null;
  }

  const timeLabel = slot.endTime ? `${slot.startTime}–${slot.endTime}` : slot.startTime;
  const teamLabel = slot.teamId ? slot.teamName || slot.title : t('schedule.noTeam');
  const counts = slotCountsTowardCapacity(slot);
  const canEdit = !isLocked && Boolean(onEdit);
  const canGoToTeam = Boolean(slot.teamId && onNavigateToTeam);

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

                {slot.location?.trim() ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('schedule.slotDetail.location')}
                      </div>
                      <div className="text-sm text-foreground">{slot.location}</div>
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
          <AlertDialogCancel asChild>
            <Button variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </AlertDialogCancel>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              icon={Pencil}
              onClick={() => {
                onEdit?.(slot);
                onClose();
              }}
            >
              {t('schedule.slotDetail.edit')}
            </Button>
          ) : null}
          {canGoToTeam ? (
            <AlertDialogAction asChild>
              <Button
                variant="default"
                icon={ExternalLink}
                onClick={() => {
                  onNavigateToTeam?.(slot);
                  onClose();
                }}
              >
                {t('schedule.slotDetail.goToTeam')}
              </Button>
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
