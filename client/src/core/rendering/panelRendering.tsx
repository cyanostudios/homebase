// client/src/core/rendering/panelRendering.tsx

import React from 'react';

export const createPanelRenderers = (
  currentPlugin: any, 
  currentPluginContext: any, 
  currentMode: string, 
  currentItem: any,
  handleSave: (data: any) => Promise<boolean>,
  handleCancel: () => void
) => {
  
  const renderPanelContent = () => {
    if (!currentPlugin || !currentPluginContext) return null;

    const ViewComponent = currentPlugin.components.View;
    const FormComponent = currentPlugin.components.Form;

    if (currentMode === 'view') {
      // DYNAMIC: Generate props based on plugin name automatically
      const singular = currentPlugin.name.slice(0, -1); // 'contacts' -> 'contact'
      const props = { [singular]: currentItem };
      
      // Also pass generic 'item' prop for plugins that might use it
      const finalProps = { ...props, item: currentItem };
      
      return <ViewComponent {...finalProps} />;
    } else {
      // DYNAMIC: Generate form props based on plugin name
      const singular = currentPlugin.name.slice(0, -1);
      const currentItemProp = `current${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
      
      const formProps = {
        [currentItemProp]: currentItem,
        currentItem: currentItem, // Fallback generic prop
        onSave: handleSave,
        onCancel: handleCancel
      };
      
      return <FormComponent {...formProps} />;
    }
  };

  const renderCurrentPage = (currentPage: string, PLUGIN_REGISTRY: any[]) => {
    const plugin = PLUGIN_REGISTRY.find(p => p.name === currentPage);
    if (!plugin) return <div>Plugin not found</div>;
    
    const ListComponent = plugin.components.List;
    return <ListComponent />;
  };

  return { 
    renderPanelContent,
    renderCurrentPage
  };
};
