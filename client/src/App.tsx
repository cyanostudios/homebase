import React, { useState, useEffect, Suspense } from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { TopBar } from '@/core/ui/TopBar';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { MainLayout } from '@/core/ui/MainLayout';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { Button } from '@/core/ui/Button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Check, X, Edit, Trash2, Building, User, StickyNote, Calculator } from 'lucide-react';

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
  
  // FIXED: Always call all plugin hooks in consistent order
  const pluginContexts = PLUGIN_REGISTRY.map(plugin => {
    try {
      return {
        plugin,
        context: plugin.hook(),
        isOpen: false, // Will be set below
      };
    } catch (error) {
      // Plugin context not available - return safe fallback
      return {
        plugin,
        context: null,
        isOpen: false,
      };
    }
  });

  const [isMobileView, setIsMobileView] = useState(false);

  // Check screen size for mobile layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileView(window.innerWidth < 768); // md breakpoint
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

 // Universal keyboard handler for Space + Arrow keys
 useEffect(() => {
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Don't interfere with form inputs, textareas, etc.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Handle Space key (existing functionality)
    if (e.code === 'Space') {
      // Check if any panel is currently open
      const isAnyPanelOpen = pluginContexts.some(({ plugin, context }) => {
        if (!context) return false;
        try {
          return context[plugin.panelKey];
        } catch {
          return false;
        }
      });

      // If a panel is open, close it
      if (isAnyPanelOpen) {
        e.preventDefault();
        const openPluginData = pluginContexts.find(({ plugin, context }) => {
          if (!context) return false;
          try {
            return context[plugin.panelKey];
          } catch {
            return false;
          }
        });

        if (openPluginData?.context) {
          const closeFunction = openPluginData.context.closeContactPanel || 
                               openPluginData.context.closeNotePanel || 
                               openPluginData.context.closeEstimatePanel;
          if (closeFunction) closeFunction();
        }
        return;
      }

      // If no panel is open, check if a table row is focused and open it
      const focusedElement = document.activeElement as HTMLElement;
      if (focusedElement && focusedElement.dataset.listItem) {
        e.preventDefault();
        
        // Parse the stored item data
        try {
          const itemData = JSON.parse(focusedElement.dataset.listItem);
          const pluginName = focusedElement.dataset.pluginName;
          
          // Find the correct plugin context
          const pluginData = pluginContexts.find(({ plugin }) => plugin.name === pluginName);
          
          if (pluginData?.context) {
            // Open the item for view using the appropriate function
            const openForViewFunction = pluginData.context.openContactForView || 
                                       pluginData.context.openNoteForView || 
                                       pluginData.context.openEstimateForView;
            if (openForViewFunction) {
              openForViewFunction(itemData);
            }
          }
        } catch (error) {
          console.error('Failed to parse item data:', error);
        }
      }
      return;
    }

    // Handle Arrow Up/Down navigation (NEW FUNCTIONALITY)
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const focusedElement = document.activeElement as HTMLElement;
      
      // Only handle arrows if we're focused on a table row with list-item data
      if (focusedElement && focusedElement.dataset.listItem) {
        e.preventDefault();
        
        // Find all focusable rows in the current table
        const tableRows = Array.from(document.querySelectorAll('[data-list-item]')) as HTMLElement[];
        const currentIndex = tableRows.indexOf(focusedElement);
        
        if (currentIndex !== -1) {
          let nextIndex: number;
          
          if (e.code === 'ArrowDown') {
            // Move to next row, wrap to first if at end
            nextIndex = currentIndex + 1 >= tableRows.length ? 0 : currentIndex + 1;
          } else {
            // Move to previous row, wrap to last if at beginning
            nextIndex = currentIndex - 1 < 0 ? tableRows.length - 1 : currentIndex - 1;
          }
          
          // Focus the new row
          tableRows[nextIndex]?.focus();
        }
      }
      return;
    }
  };

  document.addEventListener('keydown', handleGlobalKeyDown);
  return () => document.removeEventListener('keydown', handleGlobalKeyDown);
}, [pluginContexts]);

  // Now determine which panels are open (after all hooks are called)
  const openPanels = pluginContexts.filter(({ plugin, context }) => {
    if (!context) return false;
    try {
      return context[plugin.panelKey];
    } catch {
      return false;
    }
  });

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

  const isAnyPanelOpen = openPanels.length > 0;
  const currentPluginData = openPanels[0]; // First open panel wins
  const currentPlugin = currentPluginData?.plugin;
  const currentPluginContext = currentPluginData?.context;
  
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
    
    if (currentMode === 'view' && currentItem) {
      // Show item-specific info for better UX
      if (currentPlugin.name === 'contacts') {
        const contactNumber = `#${currentItem.contactNumber || currentItem.id}`;
        const name = currentItem.companyName || `${currentItem.firstName || ''} ${currentItem.lastName || ''}`.trim();
        const orgNumber = currentItem.organizationNumber || currentItem.personalNumber || '';
        
        if (isMobileView && orgNumber) {
          // Mobile: Split to multiple lines
          return (
            <div>
              <div>{contactNumber} • {name}</div>
              <div className="text-sm font-normal text-gray-600 mt-1">{orgNumber}</div>
            </div>
          );
        } else {
          // Desktop: Single line
          return `${contactNumber} • ${name}${orgNumber ? ` • ${orgNumber}` : ''}`;
        }
      } else if (currentPlugin.name === 'notes') {
        return currentItem.title || `Note #${currentItem.id}`;
      } else if (currentPlugin.name === 'estimates') {
        const estimateNumber = currentItem.estimateNumber || `#${currentItem.id}`;
        const total = `${currentItem.total?.toFixed(2) || '0.00'}`;
        const currency = currentItem.currency || 'SEK';
        
        if (isMobileView) {
          // Mobile: Split to multiple lines
          return (
            <div>
              <div className="flex items-center gap-2">
                <span>{estimateNumber} • </span>
                <button
                  onClick={() => handleEstimateContactClick(currentItem.contactId)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
                >
                  @{currentItem.contactName}
                </button>
              </div>
              <div className="text-sm font-normal text-gray-600 mt-1">{total} {currency}</div>
            </div>
          );
        } else {
          // Desktop: Single line
          return (
            <div className="flex items-center gap-2">
              <span>{estimateNumber} • </span>
              <button
                onClick={() => handleEstimateContactClick(currentItem.contactId)}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium px-1 rounded"
              >
                @{currentItem.contactName}
              </button>
              <span> • {total} {currency}</span>
            </div>
          );
        }
      }
      return `#${currentItem.id}`; // Fallback for other plugins
    }
    
    // For create/edit modes, keep descriptive titles
    const itemType = currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1); // contacts -> Contact
    switch (currentMode) {
      case 'edit': return `Edit ${itemType}`;
      case 'create': return `Create ${itemType}`;
      default: return itemType;
    }
  };

  const handleEstimateContactClick = async (contactId: string) => {
    try {
      // Get contacts from the plugin contexts
      const contactsPlugin = pluginContexts.find(p => p.plugin.name === 'contacts');
      const estimatesPlugin = pluginContexts.find(p => p.plugin.name === 'estimates');
      
      if (contactsPlugin?.context && estimatesPlugin?.context) {
        // Find the contact in contacts context
        const contacts = contactsPlugin.context.contacts || [];
        const contact = contacts.find((c: any) => c.id === contactId);
        
        if (contact) {
          // Close estimate panel and open contact
          if (estimatesPlugin.context.closeEstimatePanel) {
            estimatesPlugin.context.closeEstimatePanel();
          }
          
          if (contactsPlugin.context.openContactForView) {
            contactsPlugin.context.openContactForView(contact);
          }
        }
      }
    } catch (error) {
      console.error('Failed to navigate to contact:', error);
    }
  };

  const getPanelSubtitle = () => {
    if (!currentPlugin) return '';
    
    if (currentMode === 'view' && currentItem) {
      // Show icon + badge info in subtitle size - return JSX for rich formatting
      if (currentPlugin.name === 'contacts') {
        const isCompany = currentItem.contactType === 'company';
        const contactType = isCompany ? 'Company' : 'Private Person';
        const Icon = isCompany ? Building : User;
        const badgeColor = isCompany ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
        
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4" style={{ color: isCompany ? '#2563eb' : '#16a34a' }} />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
              {contactType}
            </span>
          </div>
        );
      } else if (currentPlugin.name === 'notes') {
        const createdDate = new Date(currentItem.createdAt).toLocaleDateString();
        return (
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-yellow-600" />
            <span>Created {createdDate}</span>
          </div>
        );
      } else if (currentPlugin.name === 'estimates') {
        const status = currentItem.status.charAt(0).toUpperCase() + currentItem.status.slice(1);
        const validTo = new Date(currentItem.validTo).toLocaleDateString();
        const statusColors = {
          draft: 'bg-gray-100 text-gray-800',
          sent: 'bg-blue-100 text-blue-800',
          accepted: 'bg-green-100 text-green-800',
          rejected: 'bg-red-100 text-red-800',
        };
        const badgeColor = statusColors[currentItem.status] || statusColors.draft;
        
        return (
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
              {status}
            </span>
            <span className="text-xs text-gray-600">• Valid to {validTo}</span>
          </div>
        );
      }
      return 'View details'; // Fallback
    }
    
    // For create/edit modes, keep instructional subtitles
    const itemType = currentPlugin.name.slice(0, -1); // contacts -> contact
    switch (currentMode) {
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