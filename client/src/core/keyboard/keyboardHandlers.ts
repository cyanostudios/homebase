// client/src/core/keyboard/keyboardHandlers.ts

import { getSingularCap } from '@/core/pluginSingular';

// Utility function to find panel functions dynamically
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }

  // Generic: action + SingularCap + "Panel"
  const fnName = `${action}${getSingularCap(pluginName)}Panel`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

/** Wrap-around next/previous index for list keyboard navigation. */
export function getNextListItemIndex(
  currentIndex: number,
  length: number,
  direction: 1 | -1,
): number {
  if (length <= 0 || currentIndex < 0) {
    return -1;
  }
  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) {
    nextIndex = length - 1;
  } else if (nextIndex >= length) {
    nextIndex = 0;
  }
  return nextIndex;
}

/**
 * Collect sibling list items for ArrowUp/ArrowDown navigation.
 * Table rows stay scoped to their `<table>`; card items use the nearest
 * ancestor that contains multiple `[data-list-item]` (typically the grid).
 */
export function collectNavigableListItems(focused: HTMLElement): HTMLElement[] {
  const table = focused.closest('table');
  if (table) {
    return Array.from(table.querySelectorAll('tr[data-list-item]')) as HTMLElement[];
  }

  const pluginName = focused.dataset.pluginName;
  let best: HTMLElement[] = [focused];
  let node: HTMLElement | null = focused.parentElement;

  while (node && node !== document.documentElement) {
    const items = Array.from(node.querySelectorAll<HTMLElement>('[data-list-item]')).filter(
      (el) => !pluginName || !el.dataset.pluginName || el.dataset.pluginName === pluginName,
    );
    if (items.includes(focused)) {
      best = items;
      if (items.length > 1) {
        break;
      }
    }
    node = node.parentElement;
  }

  return best;
}

export const createKeyboardHandler = (getPluginContexts: () => any[]) => {
  return (e: KeyboardEvent) => {
    const pluginContexts = getPluginContexts();
    // Don't interfere with form inputs, textareas, etc.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Handle Space key
    if (e.code === 'Space') {
      // Check if any panel is currently open
      const isAnyPanelOpen = pluginContexts.some(({ plugin, context }) => {
        if (!context) {
          return false;
        }
        try {
          return context[plugin.panelKey];
        } catch {
          return false;
        }
      });

      // If a panel is open, close it (no navigation guard needed for closing)
      if (isAnyPanelOpen) {
        e.preventDefault();
        const openPluginData = pluginContexts.find(({ plugin, context }) => {
          if (!context) {
            return false;
          }
          try {
            return context[plugin.panelKey];
          } catch {
            return false;
          }
        });

        if (openPluginData?.context) {
          const closeFunction = findPanelFunction(
            openPluginData.context,
            'close',
            openPluginData.plugin.name,
          );

          if (closeFunction) {
            closeFunction();
          } else {
            console.warn(`Close function not found for plugin: ${openPluginData.plugin.name}`);
          }
        }
        return;
      }

      // Focused list item: same as row click — quick context toggle on desktop
      // (activateRow), or full view on compact. Does not call openForView here.
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && focusedElement.dataset.listItem) {
        e.preventDefault();
        e.stopPropagation();
        focusedElement.click();
      }
    }

    // Handle Arrow keys for list item navigation (cards + table rows)
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const focusedElement = document.activeElement as HTMLElement;

      if (focusedElement && focusedElement.dataset.listItem) {
        const items = collectNavigableListItems(focusedElement);
        const currentIndex = items.indexOf(focusedElement);

        if (currentIndex === -1 || items.length === 0) {
          return;
        }

        e.preventDefault();

        const direction = e.code === 'ArrowUp' ? -1 : 1;
        const nextIndex = getNextListItemIndex(currentIndex, items.length, direction);
        const nextItem = nextIndex >= 0 ? items[nextIndex] : undefined;

        if (nextItem) {
          nextItem.focus();
          nextItem.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  };
};
