import { buildDuplicatedListPersonPayload, buildDuplicatedPersonCtPatch } from '../listDuplicate';
import type { GarmentPerson } from '../../types/garments';

function person(overrides: Partial<GarmentPerson> = {}): GarmentPerson {
  return {
    id: '1',
    listId: '10',
    name: 'Ada',
    shirtSize: null,
    shortsSize: null,
    socksSize: null,
    jerseyNumber: '7',
    jerseyName: 'Ada',
    initials: 'A',
    comment: null,
    contactId: null,
    teamId: null,
    checkboxValues: {},
    sortOrder: 0,
    ...overrides,
  };
}

describe('buildDuplicatedListPersonPayload', () => {
  it('includes teamId and checkbox values', () => {
    const payload = buildDuplicatedListPersonPayload(
      person({
        teamId: '5',
        checkboxValues: { paid: true, inv_3_ordered: true },
        sortOrder: 2,
      }),
    );
    expect(payload.teamId).toBe('5');
    expect(payload.checkboxValues).toEqual({ paid: true, inv_3_ordered: true });
    expect(payload.sortOrder).toBe(2);
    expect(payload.name).toBe('Ada');
  });

  it('sends null teamId when source has none', () => {
    expect(buildDuplicatedListPersonPayload(person()).teamId).toBeNull();
  });
});

describe('buildDuplicatedPersonCtPatch', () => {
  it('returns null when sizes and audiences are empty', () => {
    expect(buildDuplicatedPersonCtPatch(person())).toBeNull();
    expect(buildDuplicatedPersonCtPatch(person({ ctSizes: {}, ctAudiences: {} }))).toBeNull();
  });

  it('copies ctSizes and ctAudiences when present', () => {
    expect(
      buildDuplicatedPersonCtPatch(
        person({
          ctSizes: { '3': 'M' },
          ctAudiences: { '3': 'Women' },
        }),
      ),
    ).toEqual({
      ctSizes: { '3': 'M' },
      ctAudiences: { '3': 'Women' },
    });
  });

  it('omits empty side of the patch', () => {
    expect(buildDuplicatedPersonCtPatch(person({ ctSizes: { '3': 'L' } }))).toEqual({
      ctSizes: { '3': 'L' },
    });
    expect(buildDuplicatedPersonCtPatch(person({ ctAudiences: { '3': 'Men' } }))).toEqual({
      ctAudiences: { '3': 'Men' },
    });
  });
});
