/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 * 
 * This is the main App.tsx file that orchestrates the entire application.
 * It dynamically loads all plugins, manages global state, and handles routing.
 * 
 * 🚨 BEFORE MAKING ANY CHANGES:
 * 1. Read COLLABORATION_GUIDE.md and AI_AGENT_INSTRUCTIONS.md
 * 2. Understand that changes here affect ALL plugins
 * 3. Test thoroughly with all existing plugins (contacts, notes, estimates, tasks)
 * 4. Verify keyboard navigation still works (Space + Arrow keys)
 * 5. Check mobile responsiveness
 * 6. Ensure cross-plugin features (@mentions, references) still work
 * 
 * 📋 WHAT THIS FILE DOES:
 * - Dynamic plugin loading and context management
 * - Global navigation with unsaved changes protection
 * - Universal panel system for all plugins
 * - Keyboard navigation across all plugins
 * - Authentication and routing
 * 
 * ❌ NEVER CHANGE WITHOUT EXPLICIT NEED:
 * - Plugin discovery logic (findCurrentPlugin, findCurrentItem, findCurrentMode)
 * - Dynamic plugin context loading
 * - Keyboard handler registration
 * - Panel state management
 * 
 * ✅ SAFE TO MODIFY (with care):
 * - Import paths if files are moved
 * - New global features that don't break existing plugins
 * - Authentication flow improvements
 * 
 * 🔧 FOR NEW PLUGINS: 
 * NO CHANGES NEEDED HERE - Add to pluginRegistry.ts only
 * 
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { GlobalNavigationGuardProvider, useGlobalNavigationGuard } from '@/hooks/useGlobalNavigationGuard';

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

// Helper function to find current item from any plugin context
function findCurrentItem(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      const singular = plugin.name.slice(0, -1); // 'contacts' -> 'contact'
      const currentItemProperty = `current${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
      const currentItem = context[currentItemProperty];
      
      if (currentItem) {
        return currentItem;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

// Helper function to find current mode from any plugin context
function findCurrentMode(pluginContexts: any[]): string {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      const isOpen = context[plugin.panelKey];
      if (!isOpen) continue;
      
      if (context.panelMode) {
        return context.panelMode;
      }
    } catch (error) {
      continue;
    }
  }
  return 'create';
}

// Helper function to find current plugin based on which panel is open
function findCurrentPlugin(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) continue;
    
    try {
      const isOpen = context[plugin.panelKey];
      if (isOpen) {
        return plugin;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

// Main App Content
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  const { attemptNavigation, showWarning, confirmDiscard, cancelDiscard, warningMessage } = useGlobalNavigationGuard();
  
  // Plugin contexts - automatically load all registered plugins
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

  // Automatically detect current plugin, item, and mode
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

  // Get validation errors from current plugin context
  const validationErrors = currentPluginContext?.validationErrors || [];

  // Protected page change function - blocks navigation if unsaved changes exist
  const handlePageChange = useCallback((page: 'contacts' | 'notes' | 'estimates' | 'tasks' | 'import') => {
    attemptNavigation(() => {
      setCurrentPage(page);
    });
  }, [attemptNavigation]);

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Keyboard handler
  useEffect(() => {
    const keyboardHandler = createKeyboardHandler(pluginContexts, attemptNavigation);
    document.addEventListener('keydown', keyboardHandler);
    return () => document.removeEventListener('keydown', keyboardHandler);
  }, [pluginContexts, attemptNavigation]);

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
    <MainLayout currentPage={currentPage} onPageChange={handlePageChange}>
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

      {/* NEW: Global Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={warningMessage}
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </MainLayout>
  );
}

// Main App component
function App() {
  return (
    <AppProvider>
      <GlobalNavigationGuardProvider>
        <PluginProviders>
          <AppContent />
        </PluginProviders>
      </GlobalNavigationGuardProvider>
    </AppProvider>
  );
}

export default App;
