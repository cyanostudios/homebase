import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { TopBar } from '@/core/ui/TopBar';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import { MainLayout } from '@/core/ui/MainLayout';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { createPanelHandlers } from '@/core/handlers/panelHandlers';
import { createPanelRenderers } from '@/core/rendering/panelRendering';
import { createKeyboardHandler } from '@/core/keyboard/keyboardHandlers';
import { createPanelFooter } from '@/core/ui/PanelFooter';
import { createPanelTitles } from '@/core/ui/PanelTitles';

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

// DYNAMIC: Helper function to find current item from any plugin context
function findCurrentItem(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      // Generate the expected property name based on plugin registry naming
      const singular = plugin.name.slice(0, -1); // 'contacts' -> 'contact'
      const currentItemProperty = `current${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
      const currentItem = context[currentItemProperty];
      
      if (currentItem) {
        return currentItem;
      }
    } catch (error) {
      // Skip plugins that don't follow the naming convention
      continue;
    }
  }
  return null;
}

// DYNAMIC: Helper function to find current mode from any plugin context
function findCurrentMode(pluginContexts: any[]): string {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      // Check if this plugin's panel is open first
      const isOpen = context[plugin.panelKey];
      if (!isOpen) continue;
      
      // STANDARDIZED: All plugins now use generic 'panelMode'
      if (context.panelMode) {
        return context.panelMode;
      }
    } catch (error) {
      // Skip plugins that don't follow the naming convention
      continue;
    }
  }
  return 'create';
}

// DYNAMIC: Helper function to find current plugin based on which panel is open
function findCurrentPlugin(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      // Check if this plugin's panel is open using registry panelKey
      const isOpen = context[plugin.panelKey];
      if (isOpen) {
        return plugin;
      }
    } catch (error) {
      // Skip plugins with issues
      continue;
    }
  }
  return null;
}

// Main App Content - dramatically simplified with dynamic detection
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  
  // Plugin contexts - DYNAMIC: Automatically load all registered plugins
  const pluginContexts = PLUGIN_REGISTRY.map(plugin => {
    try {
      return { plugin, context: plugin.hook(), isOpen: false };
    } catch (error) {
      return { plugin, context: null, isOpen: false };
    }
  });

  // State
  const [isMobileView, setIsMobileView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState('contacts');

  // DYNAMIC: Automatically detect current plugin, item, and mode
  const currentPlugin = findCurrentPlugin(pluginContexts);
  const currentPluginContext = currentPlugin ? 
    pluginContexts.find(({ plugin }) => plugin.name === currentPlugin.name)?.context : null;
  const currentItem = findCurrentItem(pluginContexts);
  const currentMode = findCurrentMode(pluginContexts);

  // Check if any panel is open
  const isAnyPanelOpen = pluginContexts.some(({ plugin, context }) => {
    if (!context) return false;
    try {
      return context[plugin.panelKey];
    } catch {
      return false;
    }
  });

  // DYNAMIC: Get validation errors from current plugin context
  const validationErrors = currentPluginContext?.validationErrors || [];

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Keyboard handler
  useEffect(() => {
    const keyboardHandler = createKeyboardHandler(pluginContexts);
    document.addEventListener('keydown', keyboardHandler);
    return () => document.removeEventListener('keydown', keyboardHandler);
  }, [pluginContexts]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginComponent />;
  }

  // Create handlers and renderers
  const handlers = createPanelHandlers(pluginContexts, currentPlugin, currentPluginContext, currentMode, currentItem);
  const renderers = createPanelRenderers(currentPlugin, currentPluginContext, currentMode, currentItem, handlers.handleSave, handlers.handleCancel);
  const panelTitles = createPanelTitles(currentPlugin, currentMode, currentItem, isMobileView, handlers.handleEstimateContactClick);
  
  // Footer with delete handler that includes setShowDeleteConfirm
  const panelFooter = createPanelFooter(
    currentMode, 
    currentItem, 
    currentPluginContext, 
    validationErrors, 
    {
      ...handlers,
      currentPlugin: currentPlugin, // Pass currentPlugin for dynamic function discovery
      handleDeleteItem: () => handlers.handleDeleteItem(setShowDeleteConfirm)
    }
  );

  return (
    <MainLayout currentPage={currentPage} onPageChange={setCurrentPage}>
      <div className="h-full flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto">
          {renderers.renderCurrentPage(currentPage, PLUGIN_REGISTRY)}
        </div>
      </div>
      
      <UniversalPanel
        isOpen={isAnyPanelOpen}
        onClose={handlers.getCloseHandler()}
        title={panelTitles.getPanelTitle()}
        subtitle={panelTitles.getPanelSubtitle()}
        footer={panelFooter}
      >
        {renderers.renderPanelContent()}
      </UniversalPanel>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={`Delete ${currentPlugin ? currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1) : 'Item'}`}
        message={panelTitles.getDeleteMessage()}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handlers.confirmDelete(setShowDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </MainLayout>
  );
}

// Main App component
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

// BENEFITS OF THIS REFACTORING:
// 1. NEW PLUGINS: Zero manual updates needed in App.tsx
// 2. DYNAMIC DETECTION: Automatically finds current plugin/item/mode
// 3. NAMING CONVENTION ENFORCEMENT: Uses plugin registry for consistent naming
// 4. BACKWARDS COMPATIBLE: Falls back gracefully for edge cases
// 5. MAINTAINABLE: Single pattern for all plugin state detection