import { resolveTrainingLocation } from '../resolveTrainingLocation';
import {
  LOCATION_CUSTOM,
  LOCATION_NONE,
  applyTrainingLocationPatch,
  locationFromSelect,
  locationSelectValue,
} from '../trainingLocationSelect';

const venues = [
  { id: '2', name: 'Hall B', mapLink: 'https://maps.example/b' },
  { id: '1', name: 'Hall A', mapLink: null },
];

describe('resolveTrainingLocation', () => {
  it('uses live catalog name and map link when venueId matches', () => {
    expect(resolveTrainingLocation({ location: 'Old name', venueId: '2' }, venues)).toEqual({
      name: 'Hall B',
      mapUrl: 'https://maps.example/b',
    });
  });

  it('falls back to snapshot location with no link when venueId is stale', () => {
    expect(resolveTrainingLocation({ location: 'Old pitch', venueId: '99' }, venues)).toEqual({
      name: 'Old pitch',
      mapUrl: null,
    });
  });

  it('uses snapshot location with no link for free text', () => {
    expect(resolveTrainingLocation({ location: 'Custom pitch' }, venues)).toEqual({
      name: 'Custom pitch',
      mapUrl: null,
    });
  });
});

describe('locationSelectValue', () => {
  it('selects the matching venue', () => {
    expect(locationSelectValue({ location: 'Hall A', venueId: '1' }, venues)).toBe('1');
  });

  it('uses Other for stale id or free text', () => {
    expect(locationSelectValue({ location: 'Old pitch', venueId: '99' }, venues)).toBe(
      LOCATION_CUSTOM,
    );
    expect(locationSelectValue({ location: 'Custom' }, venues)).toBe(LOCATION_CUSTOM);
  });

  it('uses None when empty', () => {
    expect(locationSelectValue({ location: '' }, venues)).toBe(LOCATION_NONE);
  });
});

describe('locationFromSelect', () => {
  it('writes venueId and live name for a catalog choice', () => {
    expect(locationFromSelect('2', 'ignored', venues)).toEqual({
      location: 'Hall B',
      venueId: '2',
    });
  });

  it('clears venueId for None and Other', () => {
    expect(locationFromSelect(LOCATION_NONE, 'x', venues)).toEqual({
      location: '',
      venueId: undefined,
    });
    expect(locationFromSelect(LOCATION_CUSTOM, 'Custom pitch', venues)).toEqual({
      location: 'Custom pitch',
      venueId: undefined,
    });
  });
});

describe('applyTrainingLocationPatch', () => {
  const catalogPick = {
    day: 'monday',
    startTime: '17:00',
    endTime: '18:00',
    location: 'Hall B',
    venueId: '2',
  };

  it('clears venueId when Other or None is chosen after a catalog venue', () => {
    expect(
      applyTrainingLocationPatch(catalogPick, locationFromSelect(LOCATION_NONE, '', venues)),
    ).toEqual({
      day: 'monday',
      startTime: '17:00',
      endTime: '18:00',
      location: '',
    });
    expect(
      applyTrainingLocationPatch(
        catalogPick,
        locationFromSelect(LOCATION_CUSTOM, 'Custom', venues),
      ),
    ).toEqual({
      day: 'monday',
      startTime: '17:00',
      endTime: '18:00',
      location: 'Custom',
    });
  });

  it('keeps venueId when only time is patched', () => {
    expect(applyTrainingLocationPatch(catalogPick, { startTime: '18:00' }).venueId).toBe('2');
  });
});
