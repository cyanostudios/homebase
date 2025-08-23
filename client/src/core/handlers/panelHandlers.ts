// client/src/core/handlers/panelHandlers.ts

import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';

// --- helpers: hyphen-safe singular + capitalization ---
const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const singularCap = (pluginName: string) => {
  const camel = toCamel(pluginName);                              // e.g., "woocommerceProducts"
  const base = camel.endsWith('s') ? camel.slice(0, -1) : camel;  // -> "woocommerceProduct"
  return base.charAt(0).toUpperCase() + base.slice(1);            // -> "WoocommerceProduct"
};

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;

  // Special case: Woo settings use domain-specific names
  if (pluginName === 'woocommerce-products') {
    const map: Record<string, string> = {
      save: 'saveWooSettings',  // context.saveWooSettings(data)
      delete: '',               // not applicable for settings
    };
    const fn = map[action];
    return fn && typeof context[fn] === 'function' ? context[fn] : null;
  }

  // Generic: action + SingularCap
  const fnName = `${action}${singularCap(pluginName)}`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find plugin panel functions
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) return null;

  // Special case for Import plugin which doesn't follow singular naming
  if (pluginName === 'import') {
    const functionName = `${action}ImportPanel`;
    return context[functionName] || null;
  }

  // Special case: Woo settings panel
  if (pluginName === 'woocommerce-products') {
    const map: Record<string, string> = {
      close: 'closeWooSettingsPanel',
    };
    const fn = map[action];
    return fn && typeof context[fn] === 'function' ? context[fn] : null;
  }

  // Generic: action + SingularCap + "Panel"
  const fnName = `${action}${singularCap(pluginName)}Panel`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find open functions
function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) return null;

  // Special case for Import plugin
  if (pluginName === 'import') {
    const functionName = `openImportFor${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    return context[functionName] || null;
  }

  // Special case: Woo settings
  if (pluginName === 'woocommerce-products') {
    const fn = `openWooSettingsFor${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    return typeof context[fn] === 'function' ? context[fn] : null;
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
      // Special cases for global form submitters
      let functionName;
      if (currentPlugin.name === 'import') {
        functionName = 'submitImportsForm';
      } else if (currentPlugin.name === 'woocommerce-products') {
        functionName = 'submitWooSettingsForm';
      } else {
        const pluginNameCapitalized = toCamel(currentPlugin.name);
        const cap = pluginNameCapitalized.charAt(0).toUpperCase() + pluginNameCapitalized.slice(1);
        functionName = `submit${cap}Form`;
      }

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
      // Special cases for global form cancel
      let functionName;
      if (currentPlugin.name === 'import') {
        functionName = 'cancelImportsForm';
      } else if (currentPlugin.name === 'woocommerce-products') {
        functionName = 'cancelWooSettingsForm';
      } else {
        const pluginNameCapitalized = toCamel(currentPlugin.name);
        const cap = pluginNameCapitalized.charAt(0).toUpperCase() + pluginNameCapitalized.slice(1);
        functionName = `cancel${cap}Form`;
      }

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
      // Use handleCancelClick for form modes (includes unsaved changes check)
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

