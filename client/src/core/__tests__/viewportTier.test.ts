import { getViewportTier } from '@/hooks/useMediaQuery';

describe('getViewportTier', () => {
  it('maps widths to phone / pad / desktop', () => {
    expect(getViewportTier(320)).toBe('phone');
    expect(getViewportTier(767)).toBe('phone');
    expect(getViewportTier(768)).toBe('pad');
    expect(getViewportTier(1023)).toBe('pad');
    expect(getViewportTier(1024)).toBe('desktop');
    expect(getViewportTier(1440)).toBe('desktop');
  });
});
