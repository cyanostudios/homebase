// client/src/core/keyboard/keyboardHandlers.ts

import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

// --- helpers: hyphen-safe singular + capitalization (same as panelHandlers.ts) ---
const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const singularCap = (pluginName: string) => {
  const camel = toCamel(pluginName);                              // e.g., "woocommerceProducts"
  const base = camel.endsWith('s') ? camel.slice(0, -1) : camel;  // -> "woocommerceProduct"
  return base.charAt(0).toUpperCase() + base.slice(1);            // -> "WoocommerceProduct"
};

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Generic: action + SingularCap
  const fnName = `${action}${singularCap(pluginName)}`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find panel functions dynamically
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Generic: action + SingularCap + "Panel"
  const fnName = `${action}${singularCap(pluginName)}Panel`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find open functions dynamically
function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Generic: open + SingularCap + ForX
  const functionName = `open${singularCap(pluginName)}For${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  return typeof context[functionName] === 'function' ? context[functionName] : null;
}

export const createKeyboardHandler = (
  pluginContexts: any[], 
  attemptNavigation?: (action: () => void) => void
) => {
  return (e: KeyboardEvent) => {
    // Don't interfere with form inputs, textareas, etc.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Handle Space key
    if (e.code === 'Space') {
      // Check if any panel is currently open
      const isAnyPanelOpen = pluginContexts.some(({ plugin, context }) => {
        if (!context) return false;
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
          if (!context) return false;
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
            openPluginData.plugin.name
          );
          
          if (closeFunction) {
            closeFunction();
          } else {
            console.warn(`Close function not found for plugin: ${openPluginData.plugin.name}`);
          }
        }
        return;
      }

      // If no panel is open, check if a table row is focused and open it with navigation guard
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && focusedElement.dataset.listItem) {
        e.preventDefault();
        
        // Parse the stored item data
        try {
          const itemData = JSON.parse(focusedElement.dataset.listItem);
          const pluginName = focusedElement.dataset.pluginName;
          
          // Find the correct plugin context
          const pluginData = pluginContexts.find(({ plugin }) => plugin.name === pluginName);
          
          if (pluginData?.context) {
            const openForViewFunction = findOpenFunction(
              pluginData.context,
              'view',
              pluginData.plugin.name
            );
            
            if (openForViewFunction) {
              // Use navigation guard if available, otherwise open directly
              if (attemptNavigation) {
                attemptNavigation(() => {
                  openForViewFunction(itemData);
                });
              } else {
                openForViewFunction(itemData);
              }
            } else {
              console.warn(`OpenForView function not found for plugin: ${pluginData.plugin.name}`);
            }
          }
        } catch (error) {
          console.error('Failed to parse list item data:', error);
        }
      }
    }

    // Handle Arrow keys for navigation
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const focusedElement = document.activeElement as HTMLElement;
      
      // Only handle if we're focused on a table row with list item data
      if (focusedElement && focusedElement.dataset.listItem) {
        e.preventDefault();
        
        const direction = e.code === 'ArrowUp' ? -1 : 1;
        const currentRow = focusedElement;
        const table = currentRow.closest('table');
        
        if (table) {
          const rows = Array.from(table.querySelectorAll('tr[data-list-item]')) as HTMLElement[];
          const currentIndex = rows.indexOf(currentRow);
          
          if (currentIndex !== -1) {
            let nextIndex = currentIndex + direction;
            
            // Wrap around
            if (nextIndex < 0) {
              nextIndex = rows.length - 1;
            } else if (nextIndex >= rows.length) {
              nextIndex = 0;
            }
            
            const nextRow = rows[nextIndex];
            if (nextRow) {
              nextRow.focus();
            }
          }
        }
      }
    }
  };
};