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
      // Pass correct props based on plugin type
      if (currentPlugin.name === 'contacts') {
        return <ViewComponent contact={currentItem} />;
      } else if (currentPlugin.name === 'notes') {
        return <ViewComponent note={currentItem} />;
      } else if (currentPlugin.name === 'estimates') {
        return <ViewComponent estimate={currentItem} />;
      } else {
        return <ViewComponent item={currentItem} />;
      }
    } else {
      // Form mode
      return (
        <FormComponent
          currentContact={currentPlugin.name === 'contacts' ? currentItem : undefined}
          currentNote={currentPlugin.name === 'notes' ? currentItem : undefined}
          currentEstimate={currentPlugin.name === 'estimates' ? currentItem : undefined}
          currentItem={currentItem}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      );
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