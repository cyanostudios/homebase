import { SWISH_LOCK } from '@/core/qr';

import { swishLockMaskForAmount } from '../../types/siteContent';

describe('swishLockMaskForAmount', () => {
  it('always unlocks amount when null/undefined (profiles never set amount)', () => {
    expect(swishLockMaskForAmount(null)).toBe(SWISH_LOCK.AMOUNT);
    expect(swishLockMaskForAmount(undefined)).toBe(SWISH_LOCK.AMOUNT);
  });

  it('locks when amount is set (runtime cart total later)', () => {
    expect(swishLockMaskForAmount(100)).toBe(0);
  });
});
