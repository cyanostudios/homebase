import { describe, expect, it } from '@jest/globals';

import {
  resolveDetailLayoutGridClass,
  shouldPortalDetailSidebar,
  shouldPreferDetailSidebarPortal,
} from '../detailLayoutPortal';

describe('shouldPreferDetailSidebarPortal', () => {
  it('is false by default (right rail closed)', () => {
    expect(
      shouldPreferDetailSidebarPortal({
        isDesktopLayout: true,
        isRightSidebarOpen: false,
        hasSidebar: true,
      }),
    ).toBe(false);
  });

  it('is true on desktop when right rail is open and sidebar content exists', () => {
    expect(
      shouldPreferDetailSidebarPortal({
        isDesktopLayout: true,
        isRightSidebarOpen: true,
        hasSidebar: true,
      }),
    ).toBe(true);
  });

  it('stays false on phone/pad even when right rail state is open', () => {
    expect(
      shouldPreferDetailSidebarPortal({
        isDesktopLayout: false,
        isRightSidebarOpen: true,
        hasSidebar: true,
      }),
    ).toBe(false);
  });

  it('stays false when there is no sidebar content', () => {
    expect(
      shouldPreferDetailSidebarPortal({
        isDesktopLayout: true,
        isRightSidebarOpen: true,
        hasSidebar: false,
      }),
    ).toBe(false);
  });
});

describe('shouldPortalDetailSidebar', () => {
  it('requires both preferPortal and a live portal target', () => {
    expect(shouldPortalDetailSidebar(true, null)).toBe(false);
    expect(shouldPortalDetailSidebar(false, {} as Element)).toBe(false);
    expect(shouldPortalDetailSidebar(true, {} as Element)).toBe(true);
  });
});

describe('resolveDetailLayoutGridClass', () => {
  const threeCol = 'grid-cols-1 lg:grid-cols-[1.3fr_1fr_260px]';
  const defaultTwo = 'grid-cols-1 lg:grid-cols-[1fr_1fr]';

  it('drops explicit three-column templates while preferring portal (with left)', () => {
    expect(
      resolveDetailLayoutGridClass({
        preferPortal: true,
        hasLeft: true,
        gridClassName: threeCol,
        defaultGridColsClass: defaultTwo,
      }),
    ).toBe('grid-cols-1 lg:grid-cols-[1fr_1fr]');
  });

  it('uses single column when preferring portal without left', () => {
    expect(
      resolveDetailLayoutGridClass({
        preferPortal: true,
        hasLeft: false,
        gridClassName: threeCol,
        defaultGridColsClass: 'grid-cols-1 lg:grid-cols-[1fr_320px]',
      }),
    ).toBe('grid-cols-1');
  });

  it('keeps gridClassName when not preferring portal', () => {
    expect(
      resolveDetailLayoutGridClass({
        preferPortal: false,
        hasLeft: true,
        gridClassName: threeCol,
        defaultGridColsClass: defaultTwo,
      }),
    ).toBe(threeCol);
  });

  it('falls back to defaultGridColsClass when closed and no override', () => {
    expect(
      resolveDetailLayoutGridClass({
        preferPortal: false,
        hasLeft: true,
        defaultGridColsClass: defaultTwo,
      }),
    ).toBe(defaultTwo);
  });
});
