import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export type ToolbarToggleAnchorBox = {
  top: number;
  left: number;
  width: number;
};

function boxesEqual(a: ToolbarToggleAnchorBox | null, b: ToolbarToggleAnchorBox): boolean {
  return !!a && a.top === b.top && a.left === b.left && a.width === b.width;
}

/**
 * Positions the floating list-toolbar collapse control over the page shell.
 * Skips setState when the rounded box is unchanged — avoids ResizeObserver /
 * RemoveScroll layout loops (Maximum update depth with open DropdownMenus).
 */
export function useToolbarToggleAnchorBox(
  pageShellRef: RefObject<HTMLElement | null>,
): ToolbarToggleAnchorBox | null {
  const [box, setBox] = useState<ToolbarToggleAnchorBox | null>(null);

  const update = useCallback(() => {
    const el = pageShellRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const sidebarToggle = document.querySelector<HTMLElement>('[aria-controls="left-sidebar-nav"]');
    const sidebarTop = sidebarToggle?.getBoundingClientRect().top;
    const next: ToolbarToggleAnchorBox = {
      top: Math.round(typeof sidebarTop === 'number' ? sidebarTop : rect.top + 4),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    };
    setBox((prev) => (boxesEqual(prev, next) ? prev : next));
  }, [pageShellRef]);

  useLayoutEffect(() => {
    update();
    window.addEventListener('resize', update);
    const scrollParent = pageShellRef.current?.closest('.overflow-y-auto, .overflow-auto');
    scrollParent?.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (pageShellRef.current && ro) {
      ro.observe(pageShellRef.current);
    }
    return () => {
      window.removeEventListener('resize', update);
      scrollParent?.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, [pageShellRef, update]);

  return box;
}
