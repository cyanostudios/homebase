// client/src/core/rendering/panelRendering.tsx

import React from 'react';

import { getSingular, getSingularCap } from '@/core/pluginSingular';

export const createPanelRenderers = (
  currentPlugin: any,
  currentPluginContext: any,
  currentMode: string,
  currentItem: any,
  handleSave: (data: any) => Promise<boolean>,
  handleCancel: () => void,
) => {
  const renderPanelContent = () => {
    if (!currentPlugin || !currentPluginContext) {
      return null;
    }

    const ViewComponent = currentPlugin.components.View;
    const FormComponent = currentPlugin.components.Form;

    if (currentMode === 'view') {
      if (typeof ViewComponent !== 'function') {
        if (import.meta.env.DEV) {
          console.warn(
            `[panelRendering] Plugin "${currentPlugin.name}" has no View component in registry but panel mode is "view". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
          );
        }
        return null;
      }
      // DYNAMIC: Generate props based on plugin name automatically using helper
      const singularName = getSingular(currentPlugin.name);
      const props = { [singularName]: currentItem };

      // Also pass generic 'item' prop for plugins that might use it
      const finalProps = { ...props, item: currentItem };

      const ingestRunImport =
        currentPlugin.name === 'ingest' &&
        typeof currentPluginContext?.runIngestImport === 'function'
          ? {
              runIngestImport: currentPluginContext.runIngestImport as (
                id: string,
              ) => Promise<void>,
            }
          : {};

      return <ViewComponent {...finalProps} {...ingestRunImport} />;
    }

    if (typeof FormComponent !== 'function') {
      if (import.meta.env.DEV) {
        console.warn(
          `[panelRendering] Plugin "${currentPlugin.name}" has no Form component in registry but panel mode is "${currentMode}". See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
        );
      }
      return null;
    }

    // DYNAMIC: Generate form props based on plugin name using helper
    const singularCapName = getSingularCap(currentPlugin.name);
    const currentItemProp = `current${singularCapName}`;

    const formProps = {
      [currentItemProp]: currentItem,
      currentItem: currentItem, // Fallback generic prop
      onSave: handleSave,
      onCancel: handleCancel,
      ...(typeof currentPluginContext?.saveSlots === 'function'
        ? { onSaveSlots: currentPluginContext.saveSlots }
        : {}),
    };

    return <FormComponent {...formProps} />;
  };

  const renderCurrentPage = (currentPage: string, PLUGIN_REGISTRY: any[]) => {
    const plugin = PLUGIN_REGISTRY.find((p) => p.name === currentPage);
    if (!plugin) {
      return <div>Plugin not found</div>;
    }

    const ListComponent = plugin.components.List;
    if (typeof ListComponent !== 'function') {
      if (import.meta.env.DEV) {
        console.warn(
          `[panelRendering] Plugin "${plugin.name}" has no List component in registry. See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
        );
      }
      return <div>Plugin list not configured</div>;
    }
    return <ListComponent />;
  };

  return {
    renderPanelContent,
    renderCurrentPage,
  };
};
