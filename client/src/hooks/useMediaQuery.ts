import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query; updates when the match changes (e.g. resize).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** Aligns with Tailwind `md` (768px) and `lg` (1024px). See ADR VIEWPORT_TIER_PAD_SPLIT. */
export type ViewportTier = 'phone' | 'pad' | 'desktop';

export function getViewportTier(width: number): ViewportTier {
  if (width < 768) {
    return 'phone';
  }
  if (width < 1024) {
    return 'pad';
  }
  return 'desktop';
}

/** True when viewport is below Tailwind `md` (768px) — phone only. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

/** True when viewport is Tailwind `md`–below-`lg` (768–1023px). */
export function useIsPad(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/** True when viewport is Tailwind `lg`+ (≥1024px) — permanent sidebar layout. */
export function useIsDesktopLayout(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useViewportTier(): ViewportTier {
  const isPhone = useIsMobile();
  const isPad = useIsPad();
  if (isPhone) {
    return 'phone';
  }
  if (isPad) {
    return 'pad';
  }
  return 'desktop';
}
