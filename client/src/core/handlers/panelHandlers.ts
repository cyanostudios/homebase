// client/src/core/handlers/panelHandlers.ts
// REFACTORED: Dynamic plugin function discovery - eliminates manual plugin additions

import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Convert plugin name to singular for function naming
  // 'contacts' -> 'Contact', 'tasks' -> 'Task'
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `${action}${singular}`;
  
  return context[functionName] || null;
}

// Utility function to find plugin panel functions
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  // Convert plugin name to singular for function naming
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `${action}${singular}Panel`;
  
  return context[functionName] || null;
}

// Utility function to find open functions
function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) return null;
  
  const singular = pluginName.charAt(0).toUpperCase() + pluginName.slice(1, -1);
  const functionName = `open${singular}For${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  
  return context[functionName] || null;
}

export const createPanelHandlers = (
  pluginContexts: any[], 
  currentPlugin: PluginRegistryEntry | null, 
  currentPluginContext: any, 
  currentMode: string, 
  currentItem: any
) => {
  
  const handleDeleteItem = (setShowDeleteConfirm: (show: boolean) => void) => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async (setShowDeleteConfirm: (show: boolean) => void) => {
    if (currentPlugin && currentPluginContext) {
      // DYNAMIC: Find delete and close functions automatically
      const deleteFunction = findPluginFunction(currentPluginContext, 'delete', currentPlugin.name);
      const closeFunction = findPanelFunction(currentPluginContext, 'close', currentPlugin.name);
      
      if (deleteFunction && closeFunction && currentItem) {
        await deleteFunction(currentItem.id);
        closeFunction();
      }
    }
    setShowDeleteConfirm(false);
  };

  const handleSave = async (data: any) => {
    if (currentPluginContext && currentPlugin) {
      // DYNAMIC: Find save function automatically
      const saveFunction = findPluginFunction(currentPluginContext, 'save', currentPlugin.name);
      return saveFunction ? await saveFunction(data) : false;
    }
    return false;
  };

  const handleCancel = () => {
    if (currentPluginContext && currentPlugin) {
      // DYNAMIC: Find appropriate functions based on mode
      const openForViewFunction = findOpenFunction(currentPluginContext, 'view', currentPlugin.name);
      const closeFunction = findPanelFunction(currentPluginContext, 'close', currentPlugin.name);

      if (currentMode === 'edit' && currentItem && openForViewFunction) {
        openForViewFunction(currentItem);
      } else if (closeFunction) {
        closeFunction();
      }
    }
  };

  const handleSaveClick = () => {
    if (currentPlugin) {
      // DYNAMIC: Generate global function name from plugin registry
      const functionName = `submit${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`;
      const submitFunction = (window as any)[functionName];
      
      if (submitFunction) {
        submitFunction();
      } else {
        console.warn(`Global function ${functionName} not found. Make sure the plugin registers it correctly.`);
      }
    }
  };

  const handleCancelClick = () => {
    if (currentPlugin) {
      // DYNAMIC: Generate global function name from plugin registry
      const functionName = `cancel${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`;
      const cancelFunction = (window as any)[functionName];
      
      if (cancelFunction) {
        cancelFunction();
      } else {
        console.warn(`Global function ${functionName} not found. Make sure the plugin registers it correctly.`);
      }
    }
  };

  const getCloseHandler = () => {
    if (currentMode === 'view') {
      // Direct close for view mode
      return () => {
        if (currentPluginContext && currentPlugin) {
          const closeFunction = findPanelFunction(currentPluginContext, 'close', currentPlugin.name);
          if (closeFunction) closeFunction();
        }
      };
    } else {
      // FIXED: Use handleCancelClick for form modes (includes unsaved changes check)
      return handleCancelClick;
    }
  };

  const handleEstimateContactClick = (contact: any) => {
    // Find estimates plugin context dynamically
    const estimatesPlugin = PLUGIN_REGISTRY.find(p => p.name === 'estimates');
    if (!estimatesPlugin) return;
    
    const estimatesContext = pluginContexts.find(({ plugin }) => plugin.name === 'estimates')?.context;
    const contactsContext = pluginContexts.find(({ plugin }) => plugin.name === 'contacts')?.context;
    
    if (estimatesContext && contactsContext) {
      const closeContactPanel = findPanelFunction(contactsContext, 'close', 'contacts');
      const openEstimateForEdit = findOpenFunction(estimatesContext, 'edit', 'estimates');
      
      if (closeContactPanel && openEstimateForEdit) {
        closeContactPanel();
        // Pass contact information for pre-filling estimate
        const estimateData = { 
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email 
        };
        openEstimateForEdit(estimateData);
      }
    }
  };

  return {
    handleDeleteItem,
    confirmDelete,
    handleSave,
    handleCancel,
    handleSaveClick,
    handleCancelClick,
    getCloseHandler,
    handleEstimateContactClick
  };
};

// BENEFITS OF THIS REFACTORING:
// 1. NEW PLUGINS: No manual updates needed - automatic function discovery
// 2. CONSISTENT NAMING: Enforces standardized plugin function names
// 3. ERROR HANDLING: Console warnings for missing functions help debugging
// 4. MAINTAINABILITY: Single place to update function discovery logic
// 5. TYPE SAFETY: Uses plugin registry for type-safe operations