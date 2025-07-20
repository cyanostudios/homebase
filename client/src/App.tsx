import React, { useState, Suspense } from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { TopBar } from '@/core/ui/TopBar';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { MainLayout } from '@/core/ui/MainLayout';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { Button } from '@/core/ui/Button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Check, X, Edit, Trash2 } from 'lucide-react';

// Dynamic Plugin Providers - scales infinitely without App.tsx changes
function PluginProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, closeOtherPanels } = useApp();
  
  return PLUGIN_REGISTRY.reduceRight((acc, plugin) => {
    const { Provider, name } = plugin;
    return (
      <Provider
        isAuthenticated={isAuthenticated}
        onCloseOtherPanels={() => closeOtherPanels(name)}
      >
        {acc}
      </Provider>
    );
  }, children);
}

// Dynamic Panel Management - automatically handles any number of plugins
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState<string>('contacts');

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Dynamic panel detection - works with any number of plugins
  const openPanels = PLUGIN_REGISTRY.filter(plugin => {
    try {
      const context = plugin.hook();
      return context[plugin.panelKey];
    } catch {
      return false; // Plugin context not available
    }
  });

  const isAnyPanelOpen = openPanels.length > 0;
  const currentPlugin = openPanels[0]; // First open panel wins
  
  // Get current plugin context if panel is open
  const currentPluginContext = currentPlugin ? currentPlugin.hook() : null;
  const currentItem = currentPluginContext?.currentContact || 
                     currentPluginContext?.currentNote || 
                     currentPluginContext?.currentEstimate;
  const currentMode = currentPluginContext?.panelMode || 
                     currentPluginContext?.contactPanelMode || 
                     currentPluginContext?.notePanelMode || 
                     currentPluginContext?.estimatePanelMode;
  const validationErrors = currentPluginContext?.validationErrors || [];

  // Dynamic action handlers - work with any plugin
  const handleDeleteItem = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (currentPlugin && currentPluginContext) {
      const deleteFunction = currentPluginContext.deleteContact || 
                           currentPluginContext.deleteNote || 
                           currentPluginContext.deleteEstimate;
      const closeFunction = currentPluginContext.closeContactPanel || 
                           currentPluginContext.closeNotePanel || 
                           currentPluginContext.closeEstimatePanel;
      
      if (deleteFunction && closeFunction && currentItem) {
        await deleteFunction(currentItem.id);
        closeFunction();
      }
    }
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleSave = async (data: any) => {
    if (currentPluginContext) {
      const saveFunction = currentPluginContext.saveContact || 
                          currentPluginContext.saveNote || 
                          currentPluginContext.saveEstimate;
      return saveFunction ? await saveFunction(data) : false;
    }
    return false;
  };

  const handleCancel = () => {
    if (currentPluginContext) {
      const openForViewFunction = currentPluginContext.openContactForView || 
                                 currentPluginContext.openNoteForView || 
                                 currentPluginContext.openEstimateForView;
      const closeFunction = currentPluginContext.closeContactPanel || 
                           currentPluginContext.closeNotePanel || 
                           currentPluginContext.closeEstimatePanel;

      if (currentMode === 'edit' && currentItem && openForViewFunction) {
        openForViewFunction(currentItem);
      } else if (closeFunction) {
        closeFunction();
      }
    }
  };

  const handleSaveClick = () => {
    // Trigger the form submission via global function
    if (currentPlugin) {
      const submitFunction = window[`submit${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`];
      if (submitFunction) submitFunction();
    }
  };

  const handleCancelClick = () => {
    if (currentPlugin) {
      const cancelFunction = window[`cancel${currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1)}Form`];
      if (cancelFunction) cancelFunction();
      else handleCancel();
    }
  };

  const handleClosePanel = () => {
    if (currentPluginContext) {
      const closeFunction = currentPluginContext.closeContactPanel || 
                           currentPluginContext.closeNotePanel || 
                           currentPluginContext.closeEstimatePanel;
      if (closeFunction) closeFunction();
    }
  };

  // Check if there are any blocking errors (non-warning)
  const hasBlockingErrors = validationErrors.some((error: any) => !error.message.includes('Warning'));

  // Dynamic footer based on panel mode
  const getFooter = () => {
    if (currentMode === 'view') {
      return (
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            onClick={handleDeleteItem}
            variant="danger"
            icon={Trash2}
          >
            Delete
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleClosePanel}
              variant="secondary"
              icon={X}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (currentPluginContext && currentItem) {
                  const editFunction = currentPluginContext.openContactForEdit || 
                                     currentPluginContext.openNoteForEdit || 
                                     currentPluginContext.openEstimateForEdit;
                  if (editFunction) editFunction(currentItem);
                }
              }}
              variant="primary"
              icon={Edit}
            >
              Edit
            </Button>
          </div>
        </div>
      );
    }

    // Form mode (create/edit)
    return (
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          onClick={handleCancelClick}
          variant="danger"
          icon={X}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSaveClick}
          variant="primary"
          icon={Check}
          disabled={hasBlockingErrors}
        >
          {currentMode === 'edit' ? 'Update' : 'Save'}
        </Button>
      </div>
    );
  };

  const getPanelTitle = () => {
    if (!currentPlugin) return '';
    const itemType = currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1); // contacts -> Contact
    switch (currentMode) {
      case 'view': return `View ${itemType}`;
      case 'edit': return `Edit ${itemType}`;
      case 'create': return `Create ${itemType}`;
      default: return itemType;
    }
  };

  const getPanelSubtitle = () => {
    if (!currentPlugin) return '';
    const itemType = currentPlugin.name.slice(0, -1); // contacts -> contact
    switch (currentMode) {
      case 'view': return `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} information`;
      case 'edit': return `Update ${itemType} information`;
      case 'create': return `Enter new ${itemType} details`;
      default: return '';
    }
  };

  const getDeleteMessage = () => {
    if (!currentItem || !currentPlugin) return "Are you sure you want to delete this item?";
    
    const itemName = currentItem.companyName || currentItem.title || currentItem.estimateNumber || 'this item';
    return `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;
  };

  // Dynamic component rendering - works with any plugin
  const renderCurrentPage = () => {
    const plugin = PLUGIN_REGISTRY.find(p => p.name === currentPage);
    if (!plugin) return <div>Plugin not found</div>;
    
    const ListComponent = plugin.components.List;
    return <ListComponent />;
  };

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
      } else {
        return <ViewComponent item={currentItem} />;
      }
    } else {
      // Form mode
      return (
        <FormComponent
          currentContact={currentPlugin.name === 'contacts' ? currentItem : undefined}
          currentNote={currentPlugin.name === 'notes' ? currentItem : undefined}
          currentItem={currentItem}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      );
    }
  };

  return (
    <MainLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto">
          {renderCurrentPage()}
        </div>
      </div>
      
      <UniversalPanel
        isOpen={isAnyPanelOpen}
        onClose={handleCancelClick}
        title={getPanelTitle()}
        subtitle={getPanelSubtitle()}
        footer={getFooter()}
      >
        {renderPanelContent()}
      </UniversalPanel>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={`Delete ${currentPlugin ? currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1) : 'Item'}`}
        message={getDeleteMessage()}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </MainLayout>
  );
}

// Main App - constant size regardless of number of plugins
function App() {
  return (
    <AppProvider>
      <PluginProviders>
        <AppContent />
      </PluginProviders>
    </AppProvider>
  );
}

export default App;