export const createKeyboardHandler = (pluginContexts: any[]) => {
    return (e: KeyboardEvent) => {
      // Don't interfere with form inputs, textareas, etc.
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
  
      // Handle Space key (existing functionality)
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
  
        // If a panel is open, close it
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
            const closeFunction = openPluginData.context.closeContactPanel || 
                                 openPluginData.context.closeNotePanel || 
                                 openPluginData.context.closeEstimatePanel ||
                                 openPluginData.context.closeTaskPanel;
            if (closeFunction) closeFunction();
          }
          return;
        }
  
        // If no panel is open, check if a table row is focused and open it
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
              // Open the item for view using the appropriate function
              const openForViewFunction = pluginData.context.openContactForView || 
                                         pluginData.context.openNoteForView || 
                                         pluginData.context.openEstimateForView ||
                                         pluginData.context.openTaskForView;
              if (openForViewFunction) {
                openForViewFunction(itemData);
              }
            }
          } catch (error) {
            console.error('Failed to parse item data:', error);
          }
        }
        return;
      }
  
      // Handle Arrow Up/Down navigation (NEW FUNCTIONALITY)
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        const focusedElement = document.activeElement as HTMLElement;
        
        // Only handle arrows if we're focused on a table row with list-item data
        if (focusedElement && focusedElement.dataset.listItem) {
          e.preventDefault();
          
          // Find all focusable rows in the current table
          const tableRows = Array.from(document.querySelectorAll('[data-list-item]')) as HTMLElement[];
          const currentIndex = tableRows.indexOf(focusedElement);
          
          if (currentIndex !== -1) {
            let nextIndex: number;
            
            if (e.code === 'ArrowDown') {
              // Move to next row, wrap to first if at end
              nextIndex = currentIndex + 1 >= tableRows.length ? 0 : currentIndex + 1;
            } else {
              // Move to previous row, wrap to last if at beginning
              nextIndex = currentIndex - 1 < 0 ? tableRows.length - 1 : currentIndex - 1;
            }
            
            // Focus the new row
            tableRows[nextIndex]?.focus();
          }
        }
        return;
      }
    };
  };