// client/src/core/handlers/panelHandlers.ts
// Resolves save/close/open via naming conventions. See docs/PLUGIN_RUNTIME_CONVENTIONS.md.

import type { RefObject } from 'react';

import { PLUGIN_REGISTRY, type PluginRegistryEntry } from '@/core/pluginRegistry';
import { getSingularCap } from '@/core/pluginSingular';
import type { PanelFormHandle } from '@/core/types/panelFormHandle';

const isDev = import.meta.env.DEV;

// Utility function to find plugin functions dynamically
function findPluginFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: action + SingularCap
  const fnName = `${action}${getSingularCap(pluginName)}`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find plugin panel functions
function findPanelFunction(context: any, action: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: action + SingularCap + "Panel"
  const fnName = `${action}${getSingularCap(pluginName)}Panel`;
  return typeof context[fnName] === 'function' ? context[fnName] : null;
}

// Utility function to find open functions (exported for use in PanelFooter)
export function findOpenFunction(context: any, mode: string, pluginName?: string): any {
  if (!context || !pluginName) {
    return null;
  }
  // Generic: open + SingularCap + ForX
  const functionName = `open${getSingularCap(pluginName)}For${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  return typeof context[functionName] === 'function' ? context[functionName] : null;
}

export const createPanelHandlers = (
  pluginContexts: any[],
  currentPlugin: PluginRegistryEntry | null,
  currentPluginContext: any,
  currentMode: string,
  currentItem: any,
  formRef: RefObject<PanelFormHandle | null>,
) => {
  const handleSave = async (data: any) => {
    if (currentPluginContext && currentPlugin) {
      // DYNAMIC: Find save function automatically
      const saveFunction = findPluginFunction(currentPluginContext, 'save', currentPlugin.name);
      if (saveFunction) {
        return await saveFunction(data);
      }
      if (isDev) {
        const cap = getSingularCap(currentPlugin.name);
        console.warn(
          `[panelHandlers] Missing save${cap} on context for plugin "${currentPlugin.name}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
        );
      }
      return false;
    }
    return false;
  };

  const handleCancel = () => {
    if (currentPluginContext && currentPlugin) {
      const closeFunction = findPanelFunction(currentPluginContext, 'close', currentPlugin.name);

      // DYNAMIC: Find appropriate functions based on mode
      const openForViewFunction = findOpenFunction(
        currentPluginContext,
        'view',
        currentPlugin.name,
      );

      if (currentMode === 'edit' && currentItem && openForViewFunction) {
        openForViewFunction(currentItem);
      } else if (closeFunction) {
        closeFunction();
      } else if (isDev && currentPlugin) {
        const cap = getSingularCap(currentPlugin.name);
        console.warn(
          `[panelHandlers] Cancel in panel: no open${cap}ForView or close${cap}Panel for plugin "${currentPlugin.name}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
        );
      }
    }
  };

  const handleSaveClick = () => {
    if (!currentPlugin) {
      return;
    }
    if (formRef.current) {
      void formRef.current.submit();
    } else if (isDev && currentPlugin.name !== 'settings') {
      console.warn(
        `[panelHandlers] Header Save: no form handle registered for plugin "${currentPlugin.name}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
      );
    }
  };

  const handleCancelClick = () => {
    if (!currentPlugin) {
      return;
    }
    if (formRef.current) {
      formRef.current.cancel();
    } else if (isDev && currentPlugin.name !== 'settings') {
      console.warn(
        `[panelHandlers] Header Cancel: no form handle registered for plugin "${currentPlugin.name}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
      );
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
          } else if (isDev && currentPlugin) {
            const cap = getSingularCap(currentPlugin.name);
            console.warn(
              `[panelHandlers] View close: missing close${cap}Panel on context for plugin "${currentPlugin.name}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
            );
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

  const handleDuplicateItem = (setShowDuplicateDialog: (show: boolean) => void) => {
    setShowDuplicateDialog(true);
  };

  const handleEditItem = () => {
    if (!currentPluginContext || !currentItem || !currentPlugin) {
      return;
    }
    const editFn = findOpenFunction(currentPluginContext, 'edit', currentPlugin.name);
    if (editFn) {
      try {
        editFn(currentItem);
      } catch (error) {
        console.error(`Failed to open edit mode for plugin: ${currentPlugin.name}`, {
          error,
          currentItem,
        });
      }
    } else {
      console.warn(`Edit function not found for plugin: ${currentPlugin.name}`);
    }
  };

  return {
    handleDuplicateItem,
    handleSave,
    handleCancel,
    handleSaveClick,
    handleCancelClick,
    getCloseHandler,
    handleEstimateContactClick,
    handleEditItem,
  };
};
