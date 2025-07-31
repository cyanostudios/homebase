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

// Main App Content - dramatically simplified
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  
  // Plugin contexts
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
  const [currentPage, setCurrentPage] = useState<string>('contacts');

  // Mobile detection
  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = createKeyboardHandler(pluginContexts);
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pluginContexts]);

  // Loading state
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

  // Authentication check
  if (!isAuthenticated) return <LoginComponent />;

  // Panel state
  const openPanels = pluginContexts.filter(({ plugin, context }) => {
    if (!context) return false;
    try { return context[plugin.panelKey]; } catch { return false; }
  });

  const isAnyPanelOpen = openPanels.length > 0;
  const currentPluginData = openPanels[0];
  const currentPlugin = currentPluginData?.plugin;
  const currentPluginContext = currentPluginData?.context;
  
  const currentItem = currentPluginContext?.currentContact || 
                     currentPluginContext?.currentNote || 
                     currentPluginContext?.currentEstimate ||
                     currentPluginContext?.currentTask;
  const currentMode = currentPluginContext?.panelMode || 
                     currentPluginContext?.contactPanelMode || 
                     currentPluginContext?.notePanelMode || 
                     currentPluginContext?.estimatePanelMode;
  const validationErrors = currentPluginContext?.validationErrors || [];

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