import type { GarmentPerson, GarmentPersonPayload } from '../types/garments';

/** Person fields to send when duplicating a garment list. */
export function buildDuplicatedListPersonPayload(person: GarmentPerson): GarmentPersonPayload {
  return {
    name: person.name,
    shirtSize: person.shirtSize,
    shortsSize: person.shortsSize,
    socksSize: person.socksSize,
    jerseyNumber: person.jerseyNumber,
    jerseyName: person.jerseyName,
    initials: person.initials,
    comment: person.comment,
    contactId: person.contactId,
    teamId: person.teamId ?? null,
    checkboxValues: person.checkboxValues ?? {},
    sortOrder: person.sortOrder,
  };
}

/** Size/audience patch for a duplicated person, or null when nothing to copy. */
export function buildDuplicatedPersonCtPatch(person: GarmentPerson): {
  ctSizes?: Record<string, string>;
  ctAudiences?: Record<string, string>;
} | null {
  const ctSizes = person.ctSizes ?? {};
  const ctAudiences = person.ctAudiences ?? {};
  const hasSizes = Object.keys(ctSizes).length > 0;
  const hasAudiences = Object.keys(ctAudiences).length > 0;
  if (!hasSizes && !hasAudiences) {
    return null;
  }
  return {
    ...(hasSizes ? { ctSizes } : {}),
    ...(hasAudiences ? { ctAudiences } : {}),
  };
}
