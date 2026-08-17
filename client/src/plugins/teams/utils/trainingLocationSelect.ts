import type { TeamVenue, TrainingTime } from '../types/teams';

export const LOCATION_NONE = '__none__';
export const LOCATION_CUSTOM = '__custom__';

export type TrainingLocationValue = {
  location: string;
  venueId?: string;
};

export function locationSelectValue(
  training: Pick<TrainingTime, 'location' | 'venueId'>,
  venues: TeamVenue[],
): string {
  const venueId = training.venueId != null ? String(training.venueId).trim() : '';
  if (venueId && venues.some((venue) => String(venue.id) === venueId)) {
    return venueId;
  }
  if (String(training.location ?? '').trim()) {
    return LOCATION_CUSTOM;
  }
  return LOCATION_NONE;
}

export function locationFromSelect(
  selectValue: string,
  customLocation: string,
  venues: TeamVenue[],
): TrainingLocationValue {
  if (selectValue === LOCATION_NONE) {
    return { location: '', venueId: undefined };
  }
  if (selectValue === LOCATION_CUSTOM) {
    return { location: customLocation, venueId: undefined };
  }
  const venue = venues.find((item) => String(item.id) === selectValue);
  if (!venue) {
    return { location: customLocation, venueId: undefined };
  }
  return { location: venue.name, venueId: venue.id };
}

export function applyTrainingLocationPatch(
  training: TrainingTime,
  patch: Partial<TrainingTime>,
): TrainingTime {
  const next = { ...training, ...patch };
  if ('venueId' in patch && !patch.venueId) {
    delete next.venueId;
  }
  return next;
}
