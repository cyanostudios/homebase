const TeamModel = require('../model');

const sanitizeTrainingTimes = TeamModel.sanitizeTrainingTimes;

describe('sanitizeTrainingTimes venueId', () => {
  const base = {
    day: 'monday',
    startTime: '17:00',
    endTime: '18:00',
    location: 'Pitch A',
    countsTowardCapacity: true,
  };

  test('keeps a valid venueId as a trimmed string of a positive integer', () => {
    expect(sanitizeTrainingTimes([{ ...base, venueId: ' 42 ' }])).toEqual([
      { ...base, venueId: '42' },
    ]);
    expect(sanitizeTrainingTimes([{ ...base, venueId: 7 }])).toEqual([{ ...base, venueId: '7' }]);
  });

  test('drops garbage venueId instead of storing it', () => {
    const withoutVenue = [{ ...base }];
    expect(sanitizeTrainingTimes([{ ...base, venueId: 'abc' }])).toEqual(withoutVenue);
    expect(sanitizeTrainingTimes([{ ...base, venueId: '0' }])).toEqual(withoutVenue);
    expect(sanitizeTrainingTimes([{ ...base, venueId: '-3' }])).toEqual(withoutVenue);
    expect(sanitizeTrainingTimes([{ ...base, venueId: '12.5' }])).toEqual(withoutVenue);
    expect(sanitizeTrainingTimes([{ ...base, venueId: '1'.repeat(21) }])).toEqual(withoutVenue);
    expect(sanitizeTrainingTimes([{ ...base, venueId: '' }])).toEqual(withoutVenue);
  });

  test('leaves old JSON without venueId intact', () => {
    const legacy = [{ ...base }];
    expect(sanitizeTrainingTimes(legacy)).toEqual(legacy);
    expect(sanitizeTrainingTimes(JSON.stringify(legacy))).toEqual(legacy);
    expect(sanitizeTrainingTimes(legacy)[0]).not.toHaveProperty('venueId');
  });

  test('does not copy mapLink onto training times', () => {
    const result = sanitizeTrainingTimes([
      { ...base, venueId: '3', mapLink: 'https://maps.example/x' },
    ]);
    expect(result[0].venueId).toBe('3');
    expect(result[0]).not.toHaveProperty('mapLink');
  });

  test('caps at 50 training times', () => {
    const many = Array.from({ length: 60 }, () => ({ ...base, venueId: '1' }));
    expect(sanitizeTrainingTimes(many)).toHaveLength(50);
  });
});
