import { Check, Clock } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailSection } from '@/core/ui/DetailSection';

import { useScheduleSettings } from '../hooks/useScheduleSettings';
import { normalizeScheduleGridSettings } from '../types/schedule';

interface ScheduleSettingsViewProps {
  inlineTrailing?: React.ReactNode;
}

export function ScheduleSettingsView({ inlineTrailing }: ScheduleSettingsViewProps = {}) {
  const { t } = useTranslation();
  const { gridSettings, setGridSettings, isLoading, isSaving, isDirty, save } =
    useScheduleSettings();

  const handleStartHourChange = useCallback(
    (value: string) => {
      const next = normalizeScheduleGridSettings({
        ...gridSettings,
        startHour: Number(value),
      });
      setGridSettings(next);
    },
    [gridSettings, setGridSettings],
  );

  const handleEndHourChange = useCallback(
    (value: string) => {
      const next = normalizeScheduleGridSettings({
        ...gridSettings,
        endHour: Number(value),
      });
      setGridSettings(next);
    },
    [gridSettings, setGridSettings],
  );

  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="mr-4 flex min-w-0 flex-1 items-center gap-4">
          <h2 className="shrink-0 truncate text-lg font-semibold tracking-tight">
            {t('schedule.settings.title')}
          </h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">{inlineTrailing}</div>
      </div>

      <Card padding="md" className="overflow-hidden border border-border/70 bg-card shadow-sm">
        <DetailSection
          title={
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{t('schedule.settings.gridHoursSection')}</span>
            </div>
          }
          className="pt-0"
        >
          <p className="mb-4 text-sm text-muted-foreground">
            {t('schedule.settings.gridHoursHint')}
          </p>
          <div className="grid max-w-md grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">{t('schedule.settings.startHourLabel')}</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={gridSettings.startHour}
                onChange={(event) => handleStartHourChange(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t('schedule.settings.endHourLabel')}</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={gridSettings.endHour}
                onChange={(event) => handleEndHourChange(event.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('schedule.settings.gridHoursPreview', {
              start: String(gridSettings.startHour).padStart(2, '0'),
              end: String(gridSettings.endHour).padStart(2, '0'),
            })}
          </p>
        </DetailSection>
      </Card>

      {isDirty ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSave}
            variant="primary"
            size="sm"
            icon={Check}
            disabled={isSaving}
            className="h-9 border-none bg-green-600 px-3 text-xs text-white hover:bg-green-700"
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
