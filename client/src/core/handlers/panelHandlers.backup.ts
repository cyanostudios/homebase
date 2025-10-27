// client/src/core/handlers/panelHandlers.ts

import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';

// --- helpers: hyphen-safe singular + capitalization ---
const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const singularCap = (pluginName: string) => {
  const camel = toCamel(pluginName); // e.g., "woocommerceProducts"
  const base = camel.endsWith('s') ? camel.slice(0, -1) : camel; // -> "woocommerceProduct"
  return base.charAt(0).toUpperCase() + base.slice(1); // -> "WoocommerceProduct"
};

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: action + SingularCap
  const fnName = `${action}${singularCap(pluginName)}`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find plugin panel functions
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: action + SingularCap + "Panel"
  const fnName = `${action}${singularCap(pluginName)}Panel`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find open functions
function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: open + SingularCap + ForX
  const functionName = `open${singularCap(pluginName)}For${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  return typeof context[functionName] === 'function' ? context[functionName] : null;
}

export const createPanelHandlers = (
  pluginContexts: any[],
  currentPlugin: PluginRegistryEntry | null,
  currentPluginContext: any,
  currentMode: string,
  currentItem: any,
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
      const closeFunction = findPanelFunction(currentPluginContext, 'close', currentPlugin.name);

      // ✅ Files: stäng panel direkt vid Cancel i edit (hoppa inte till view)
      if (currentPlugin.name === 'files' && closeFunction) {
        closeFunction();
        return;
      }

      // DYNAMIC: Find appropriate functions based on mode
      const openForViewFunction = findOpenFunction(currentPluginContext, 'view', currentPlugin.name);

      if (currentMode === 'edit' && currentItem && openForViewFunction) {
        openForViewFunction(currentItem);
      } else if (closeFunction) {
        closeFunction();
      }
    }
  };

  const handleSaveClick = () => {
    if (currentPlugin) {
      // Generic pattern: submit + PluginName + Form
      const pluginNameCapitalized = toCamel(currentPlugin.name);
      const cap = pluginNameCapitalized.charAt(0).toUpperCase() + pluginNameCapitalized.slice(1);
      const functionName = `submit${cap}Form`;

      const submitFunction = (window as any)[functionName];

      if (submitFunction) {
        submitFunction();
      } else {
        console.warn(
          `Global function ${functionName} not found. Make sure the plugin registers it correctly.`,
        );
      }
    }
  };

  const handleCancelClick = () => {
    if (currentPlugin) {
      // Generic pattern: cancel + PluginName + Form
      const pluginNameCapitalized = toCamel(currentPlugin.name);
      const cap = pluginNameCapitalized.charAt(0).toUpperCase() + pluginNameCapitalized.slice(1);
      const functionName = `cancel${cap}Form`;

      const cancelFunction = (window as any)[functionName];

      if (cancelFunction) {
        cancelFunction();
      } else {
        console.warn(
          `Global function ${functionName} not found. Make sure the plugin registers it correctly.`,
        );
      }
    }
  };

  const getCloseHandler = () => {
    if (currentMode === 'view') {
      // Direct close for view mode
      return () => {
        if (currentPluginContext && currentPlugin) {
          const closeFunction = findPanelFunction(
            currentPluginContext,
            'close',
            currentPlugin.name,
          );
          if (closeFunction) {
            closeFunction();
          }
        }
      };
    } else {
      // Use handleCancelClick for form modes (includes unsaved changes check)
      return handleCancelClick;
    }
  };

  const handleEstimateContactClick = (contactId: string) => {
    // Find estimates plugin context dynamically
    const estimatesPlugin = PLUGIN_REGISTRY.find((p) => p.name === 'estimates');
    if (!estimatesPlugin) {
      return;
    }

    const estimatesContext = pluginContexts.find(
      ({ plugin }) => plugin.name === 'estimates',
    )?.context;
    const contactsContext = pluginContexts.find(
      ({ plugin }) => plugin.name === 'contacts',
    )?.context;

    if (estimatesContext && contactsContext) {
      const closeContactPanel = findPanelFunction(contactsContext, 'close', 'contacts');
      const openEstimateForView = findOpenFunction(estimatesContext, 'view', 'estimates');

      if (closeContactPanel && openEstimateForView) {
        closeContactPanel();
        // Navigate to estimate view - pass contactId for context
        openEstimateForView({ contactId });
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
    handleEstimateContactClick,
  };
};
