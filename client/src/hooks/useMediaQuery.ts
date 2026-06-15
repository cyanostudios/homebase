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

/** True when viewport is below Tailwind `md` (768px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
