export type ClubdeskSiteCardKey = 'home' | 'info' | 'swish';

export interface ClubdeskSiteContentCard {
  cardKey: ClubdeskSiteCardKey;
  content: string;
  meta: Record<string, unknown>;
  updatedAt: string | null;
}

export type ClubdeskSiteContentMap = Record<ClubdeskSiteCardKey, ClubdeskSiteContentCard>;

/**
 * Runtime Swish Type C lock mask.
 * Empty amount → unlock amount so the payer can enter the sum after scanning.
 * Uses the same bit as `@/core/qr` `SWISH_LOCK.AMOUNT` (2).
 */
export function swishLockMaskForAmount(amount: number | null | undefined): number {
  const AMOUNT_EDITABLE = 2;
  return amount == null ? AMOUNT_EDITABLE : 0;
}
