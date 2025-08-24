// client/src/core/rendering/panelRendering.tsx

import React from 'react';

// --- helpers: hyphen-safe singular + capitalization ---
const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const singularCap = (pluginName: string) => {
  const camel = toCamel(pluginName);                              // e.g., "woocommerceProducts"
  const base = camel.endsWith('s') ? camel.slice(0, -1) : camel;  // -> "woocommerceProduct"
  return base.charAt(0).toUpperCase() + base.slice(1);            // -> "WoocommerceProduct"
};

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
      // DYNAMIC: Generate props based on plugin name automatically using helper
      const singularName = singularCap(currentPlugin.name).toLowerCase(); // 'woocommerceProduct' -> 'woocommerceproduct'
      const props = { [singularName]: currentItem };
      
      // Also pass generic 'item' prop for plugins that might use it
      const finalProps = { ...props, item: currentItem };
      
      return <ViewComponent {...finalProps} />;
    } else {
      // DYNAMIC: Generate form props based on plugin name using helper
      const singularCapName = singularCap(currentPlugin.name); // 'WoocommerceProduct'
      const currentItemProp = `current${singularCapName}`;
      
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