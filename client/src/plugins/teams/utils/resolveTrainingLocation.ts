import type { TeamVenue, TrainingTime } from '../types/teams';

export type ResolvedTrainingLocation = {
  name: string;
  mapUrl: string | null;
};

export function resolveTrainingLocation(
  training: Pick<TrainingTime, 'location' | 'venueId'>,
  venues: TeamVenue[],
): ResolvedTrainingLocation {
  const venueId = training.venueId != null ? String(training.venueId).trim() : '';
  if (venueId) {
    const venue = venues.find((item) => String(item.id) === venueId);
    if (venue) {
      return {
        name: venue.name,
        mapUrl: venue.mapLink?.trim() ? venue.mapLink.trim() : null,
      };
    }
  }

  return {
    name: String(training.location ?? '').trim(),
    mapUrl: null,
  };
}
