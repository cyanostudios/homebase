/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the main App.tsx file that orchestrates the entire application.
 * It dynamically loads all plugins, manages global state, and handles routing.
 *
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import React, { useState, useEffect, useCallback } from 'react';

import { AppProvider, useApp } from '@/core/api/AppContext';
import { createPanelHandlers } from '@/core/handlers/panelHandlers';
import { createKeyboardHandler } from '@/core/keyboard/keyboardHandlers';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { createPanelRenderers } from '@/core/rendering/panelRendering';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { MainLayout } from '@/core/ui/MainLayout';
import { createPanelFooter } from '@/core/ui/PanelFooter';
import { createPanelTitles } from '@/core/ui/PanelTitles';
import type { NavPage } from '@/core/ui/Sidebar'; // <-- viktig typ-import
import { TopBar } from '@/core/ui/TopBar';
import { UniversalPanel } from '@/core/ui/UniversalPanel';
import {
  GlobalNavigationGuardProvider,
  useGlobalNavigationGuard,
} from '@/hooks/useGlobalNavigationGuard';

// Begränsad typ för AppContext.closeOtherPanels
type CorePanel = 'contacts' | 'notes' | 'estimates' | 'tasks';
function isCorePanelName(name: string): name is CorePanel {
  return name === 'contacts' || name === 'notes' || name === 'estimates' || name === 'tasks';
}

// Dynamic Plugin Providers - scales infinitely without App.tsx changes
function PluginProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, closeOtherPanels } = useApp();

  return PLUGIN_REGISTRY.reduceRight((acc, plugin) => {
    const { Provider, name } = plugin;
    return (
      <Provider
        isAuthenticated={isAuthenticated}
        onCloseOtherPanels={(exceptArg?: any) => {
          // Ny, konsekvent default: om inget skickas in → undanta mitt eget namn
          const effectiveExcept = typeof exceptArg !== 'undefined' ? exceptArg : name;
          closeOtherPanels(effectiveExcept as any);
        }}
      >
        {acc}
      </Provider>
    );
  }, children);
}

// Helper: find current item from any plugin context
function findCurrentItem(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) {
      continue;
    }
    try {
      const singular = plugin.name.slice(0, -1); // 'contacts' -> 'contact'
      const currentItemProperty = `current${singular.charAt(0).toUpperCase() + singular.slice(1)}`;
      const currentItem = context[currentItemProperty];
      if (currentItem) {
        return currentItem;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Helper: find current mode
function findCurrentMode(pluginContexts: any[]): 'create' | 'edit' | 'view' {
  for (const { plugin, context } of pluginContexts) {
    if (!context) {
      continue;
    }
    try {
      const isOpen = context[plugin.panelKey];
      if (!isOpen) {
        continue;
      }
      const mode = context.panelMode;
      if (mode === 'create' || mode === 'edit' || mode === 'view') {
        return mode;
      }
    } catch {
      continue;
    }
  }
  return 'create';
}

// Helper: find current plugin with an open panel
function findCurrentPlugin(pluginContexts: any[]): any {
  for (const { plugin, context } of pluginContexts) {
    if (!context) {
      continue;
    }
    try {
      const isOpen = context[plugin.panelKey];
      if (isOpen) {
        return plugin;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Main App Content
function AppContent() {
  const { isAuthenticated, isLoading } = useApp();
  const { attemptNavigation, showWarning, confirmDiscard, cancelDiscard, warningMessage } =
    useGlobalNavigationGuard();

  // Plugin contexts - automatically load all registered plugins
  const pluginContexts = PLUGIN_REGISTRY.map((plugin) => {
    try {
      return { plugin, context: plugin.hook(), isOpen: false };
    } catch {
      return { plugin, context: null, isOpen: false };
    }
  });

  // State
  const [isMobileView, setIsMobileView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState<NavPage>('contacts'); // <-- typad som NavPage

  // Auto-detect current plugin/item/mode
  const currentPlugin = findCurrentPlugin(pluginContexts);
  const currentPluginContext = currentPlugin
    ? pluginContexts.find(({ plugin }) => plugin.name === currentPlugin.name)?.context
    : null;
  const currentItem = findCurrentItem(pluginContexts);
  const currentMode = findCurrentMode(pluginContexts);

  // Is any panel open?
  const isAnyPanelOpen = pluginContexts.some(({ plugin, context }) => {
    if (!context) {
      return false;
    }
    try {
      return context[plugin.panelKey];
    } catch {
      return false;
    }
  });

  const validationErrors = currentPluginContext?.validationErrors || [];

  // Protected page change
  const handlePageChange = useCallback(
    (page: NavPage) => {
      // <-- också typad som NavPage
      attemptNavigation(() => setCurrentPage(page));
    },
    [attemptNavigation],
  );

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
  const handlers = createPanelHandlers(
    pluginContexts,
    currentPlugin,
    currentPluginContext,
    currentMode,
    currentItem,
  );
  const renderers = createPanelRenderers(
    currentPlugin,
    currentPluginContext,
    currentMode,
    currentItem,
    handlers.handleSave,
    handlers.handleCancel,
  );
  const panelTitles = createPanelTitles(
    currentPlugin,
    currentMode,
    currentItem,
    isMobileView,
    handlers.handleEstimateContactClick,
    currentPluginContext,
  );

  // Footer with delete handler
  const panelFooter = createPanelFooter(
    currentMode,
    currentItem,
    currentPluginContext,
    validationErrors,
    {
      ...handlers,
      currentPlugin,
      handleDeleteItem: () => handlers.handleDeleteItem(setShowDeleteConfirm),
    },
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
        title={`Delete ${
          currentPlugin
            ? currentPlugin.name.charAt(0).toUpperCase() + currentPlugin.name.slice(1, -1)
            : 'Item'
        }`}
        message={panelTitles.getDeleteMessage()}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handlers.confirmDelete(setShowDeleteConfirm)}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      {/* Global Unsaved Changes Warning */}
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
