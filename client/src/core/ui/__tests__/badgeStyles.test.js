const {
  BADGE_CHIP_CLASS,
  BADGE_CHIP_COMPACT_CLASS,
  BADGE_SELECT_TRIGGER_CLASS,
  QC_STATUS_BADGE_COLORS,
  DUE_DATE_BADGE_COLORS,
} = require('../badgeStyles');

describe('badgeStyles chips', () => {
  test('chip shells are plain inline text labels (no padding/height chrome)', () => {
    expect(BADGE_CHIP_CLASS).toMatch(/p-0/);
    expect(BADGE_CHIP_CLASS).toMatch(/h-auto/);
    expect(BADGE_CHIP_CLASS).toMatch(/bg-transparent/);
    expect(BADGE_CHIP_CLASS).toMatch(/border-0/);
    expect(BADGE_CHIP_CLASS).toMatch(/font-extrabold/);
    expect(BADGE_CHIP_CLASS).toMatch(/tracking-wide/);
    expect(BADGE_CHIP_CLASS).toMatch(/\btext-xs\b/);
    expect(BADGE_CHIP_CLASS).not.toMatch(/\bh-5\b/);
    expect(BADGE_CHIP_COMPACT_CLASS).toMatch(/p-0/);
    expect(BADGE_CHIP_COMPACT_CLASS).toMatch(/h-auto/);
    expect(BADGE_CHIP_COMPACT_CLASS).toMatch(/text-\[10px\]/);
  });

  test('status colors are text-only, not fills or borders', () => {
    expect(QC_STATUS_BADGE_COLORS.info).toMatch(/text-blue/);
    expect(QC_STATUS_BADGE_COLORS.info).not.toMatch(/border-/);
    expect(QC_STATUS_BADGE_COLORS.info).not.toMatch(/bg-blue/);
    expect(QC_STATUS_BADGE_COLORS.info).not.toMatch(/ring-1/);
    expect(DUE_DATE_BADGE_COLORS.overdue).toBe(QC_STATUS_BADGE_COLORS.danger);
  });

  test('badge select triggers keep SelectValue as flex (not line-clamp block)', () => {
    expect(BADGE_SELECT_TRIGGER_CLASS).toMatch(/\[&>span\]:!flex/);
    expect(BADGE_SELECT_TRIGGER_CLASS).toMatch(/py-0/);
    expect(BADGE_SELECT_TRIGGER_CLASS).not.toMatch(/line-clamp/);
    expect(BADGE_SELECT_TRIGGER_CLASS).not.toMatch(/\[&>span\]:h-full/);
  });
});
