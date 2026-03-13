// Bulk edit Visible and Notifications for selected slots (same options as Slot properties).

import { SlidersHorizontal } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Heading } from '@/core/ui/Typography';

import { slotsApi } from '../api/slotsApi';
import type { Slot } from '../types/slots';

export interface BulkPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlots: Slot[];
  onSuccess?: () => void;
}

type Phase = 'idle' | 'applying' | 'done';

export function BulkPropertiesDialog({
  isOpen,
  onClose,
  selectedSlots,
  onSuccess,
}: BulkPropertiesDialogProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const handleApply = useCallback(async () => {
    if (selectedSlots.length === 0) {
      return;
    }
    setPhase('applying');
    setUpdatedCount(0);
    setFailedCount(0);
    let updated = 0;
    let failed = 0;
    for (const slot of selectedSlots) {
      try {
        await slotsApi.updateSlot(slot.id, {
          ...slot,
          visible,
          notifications_enabled: notificationsEnabled,
        });
        updated += 1;
      } catch {
        failed += 1;
      }
      setUpdatedCount(updated);
      setFailedCount(failed);
    }
    setPhase('done');
  }, [selectedSlots, visible, notificationsEnabled]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
    onClose();
  }, [onClose]);

  const handleDoneClose = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [onSuccess, handleClose]);

  if (!isOpen) {
    return null;
  }

  const count = selectedSlots.length;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'applying' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-background rounded-xl shadow-xl border overflow-hidden flex flex-col max-h-full">
          <div className="p-4 border-b shrink-0">
            <Heading level={3} className="mb-0 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
              {t('slots.bulkPropertiesTitle', { defaultValue: 'Properties' })}
            </Heading>
            <div className="text-xs text-muted-foreground mt-1">
              {t('slots.bulkPropertiesSubtitle', {
                count,
                defaultValue: 'Apply to {{count}} slot(s)',
              })}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-4 min-h-0 overflow-auto">
            {phase === 'idle' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-foreground">
                    {t('common.visible')}
                  </label>
                  <Switch
                    checked={visible}
                    onCheckedChange={setVisible}
                    className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-foreground">
                    {t('common.notifications')}
                  </label>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                    className="h-4 w-7 data-[state=checked]:bg-primary [&>span]:h-3 [&>span]:w-3 [&[data-state=checked]>span]:translate-x-3"
                  />
                </div>
              </div>
            )}
            {phase === 'applying' && (
              <p className="text-sm text-muted-foreground">
                {t('slots.bulkPropertiesApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                  defaultValue: 'Updating {{current}} of {{total}}…',
                })}
              </p>
            )}
            {phase === 'done' && (
              <div className="text-sm space-y-1">
                <p className="text-foreground font-medium">
                  {t('slots.bulkPropertiesDone', { defaultValue: 'Done' })}
                </p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('slots.bulkPropertiesResult', {
                    updated: updatedCount,
                    failed: failedCount,
                    defaultValue: '{{updated}} updated, {{failed}} failed',
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="p-4 border-t flex items-center justify-end gap-2 shrink-0">
            {phase === 'done' ? (
              <Button variant="secondary" size="sm" onClick={handleDoneClose}>
                {t('common.close')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={phase === 'applying'}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={phase === 'applying' || count === 0}
                >
                  {phase === 'applying'
                    ? t('slots.bulkPropertiesApplyingShort', { defaultValue: 'Updating…' })
                    : t('slots.bulkPropertiesApply', { defaultValue: 'Apply' })}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
