// client/src/core/rendering/panelRendering.tsx

import React from 'react';

import { getSingular, getSingularCap } from '@/core/pluginSingular';

// Accepts both regular React components (functions) and React.lazy exotic components (objects).
// React.isValidElementType is an internal API not exported from the react package.
function isRenderableComponent(c: unknown): boolean {
  return typeof c === 'function' || (c !== null && c !== undefined && typeof c === 'object');
}

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
      if (!isRenderableComponent(ViewComponent)) {
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

      return (
        <React.Suspense fallback={null}>
          <ViewComponent {...finalProps} {...ingestRunImport} />
        </React.Suspense>
      );
    }

    if (!isRenderableComponent(FormComponent)) {
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

    return (
      <React.Suspense fallback={null}>
        <FormComponent {...formProps} />
      </React.Suspense>
    );
  };

  const renderCurrentPage = (currentPage: string, PLUGIN_REGISTRY: any[]) => {
    const plugin = PLUGIN_REGISTRY.find((p) => p.name === currentPage);
    if (!plugin) {
      return <div>Plugin not found</div>;
    }

    const ListComponent = plugin.components.List;
    if (!isRenderableComponent(ListComponent)) {
      if (import.meta.env.DEV) {
        console.warn(
          `[panelRendering] Plugin "${plugin.name}" has no List component in registry. See docs/PLUGIN_RUNTIME_CONVENTIONS.md`,
        );
      }
      return <div>Plugin list not configured</div>;
    }
    return (
      <React.Suspense fallback={null}>
        <ListComponent />
      </React.Suspense>
    );
  };

  return {
    renderPanelContent,
    renderCurrentPage,
  };
};
