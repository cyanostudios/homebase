// client/src/core/keyboard/keyboardHandlers.ts

import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Convert plugin name to singular for function naming
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `${action}${singular}`;
  
  return context[functionName] || null;
}

// Utility function to find panel functions dynamically
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `${action}${singular}Panel`;
  
  return context[functionName] || null;
}

// Utility function to find open functions dynamically
function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `open${singular}For${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  
  return context[functionName] || null;
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