import { MapPin } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { useTeamVenues } from '../hooks/useTeamVenues';
import type { TrainingTime } from '../types/teams';
import {
  LOCATION_CUSTOM,
  LOCATION_NONE,
  locationFromSelect,
  locationSelectValue,
} from '../utils/trainingLocationSelect';

export function TrainingLocationField({
  training,
  onChange,
  className,
  selectClassName,
}: {
  training: Pick<TrainingTime, 'location' | 'venueId'>;
  onChange: (next: { location: string; venueId?: string }) => void;
  className?: string;
  selectClassName?: string;
}) {
  const { t } = useTranslation();
  const { venues, isLoading, loadError } = useTeamVenues();

  const selectValue = useMemo(() => locationSelectValue(training, venues), [training, venues]);
  const showCatalog = !isLoading && venues.length > 0 && !loadError;
  const showCustomInput = !showCatalog || selectValue === LOCATION_CUSTOM;

  if (!showCatalog) {
    return (
      <div className={className}>
        <Input
          value={training.location}
          onChange={(event) => onChange({ location: event.target.value, venueId: undefined })}
          className="h-9"
          placeholder={
            loadError ? t('teams.form.venuesLoadError') : t('teams.form.locationPlaceholder')
          }
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Select
        value={selectValue}
        onValueChange={(value) => {
          onChange(locationFromSelect(value, training.location, venues));
        }}
      >
        <SelectTrigger className={cn('h-9 w-full text-sm', selectClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={LOCATION_NONE}>{t('teams.form.locationNone')}</SelectItem>
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              <span className="inline-flex items-center gap-1.5">
                {venue.mapLink ? (
                  <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden />
                ) : null}
                {venue.name}
              </span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={LOCATION_CUSTOM}>{t('teams.form.locationCustom')}</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput ? (
        <Input
          value={training.location}
          onChange={(event) => onChange({ location: event.target.value, venueId: undefined })}
          className="h-9"
          placeholder={t('teams.form.locationPlaceholder')}
        />
      ) : null}
    </div>
  );
}
