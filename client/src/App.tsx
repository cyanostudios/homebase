/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the main App.tsx file that orchestrates the entire application.
 * It dynamically loads all plugins, manages global state, and handles routing.
 *
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';

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
import { ActivityLogForm } from '@/core/ui/SettingsForms/ActivityLogForm';
import { PreferencesSettingsForm } from '@/core/ui/SettingsForms/PreferencesSettingsForm';
import { ProfileSettingsForm } from '@/core/ui/SettingsForms/ProfileSettingsForm';
import { ProfixioSettingsForm } from '@/core/ui/SettingsForms/ProfixioSettingsForm';
import { SettingsList } from '@/core/ui/SettingsList';
import type { NavPage } from '@/core/ui/Sidebar'; // <-- viktig typ-import
import {
  GlobalNavigationGuardProvider,
  useGlobalNavigationGuard,
} from '@/hooks/useGlobalNavigationGuard';

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

  // Initialize currentPage from localStorage, fallback to 'contacts'
  const [currentPage, setCurrentPage] = useState<NavPage>(() => {
    const saved = localStorage.getItem('homebase:currentPage');
    return (saved as NavPage) || 'contacts';
  });

  const [settingsCategory, setSettingsCategory] = useState<string | null>(null);

  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('homebase:currentPage', currentPage);
  }, [currentPage]);

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

  // All hooks must be before early returns
  const currentPagePlugin = useMemo(() => {
    return PLUGIN_REGISTRY.find(
      (plugin) =>
        plugin.name === currentPage ||
        plugin.navigation?.submenu?.some((item) => item.page === currentPage),
    );
  }, [currentPage]);

  const contentTitle = useMemo(() => {
    if (currentPage === 'settings') {
      return 'Settings';
    }

    if (!currentPagePlugin?.navigation) {
      return currentPage;
    }

    if (currentPagePlugin.name === currentPage) {
      return currentPagePlugin.navigation.label;
    }

    const sub = currentPagePlugin.navigation.submenu?.find((item) => item.page === currentPage);
    return sub?.label || currentPagePlugin.navigation.label;
  }, [currentPage, currentPagePlugin]);

  const primaryAction = useMemo(() => {
    if (!currentPagePlugin || currentPagePlugin.name !== currentPage) {
      return null;
    }

    // Disable Add button for profixio plugin (read-only)
    if (currentPagePlugin.name === 'profixio') {
      return null;
    }

    const context = pluginContexts.find(
      ({ plugin }) => plugin.name === currentPagePlugin.name,
    )?.context;
    if (!context) {
      return null;
    }

    const toCamel = (name: string) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const singular = (label: string) => (label.endsWith('s') ? label.slice(0, -1) : label);
    const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

    const fnName = `open${cap(singular(toCamel(currentPagePlugin.name)))}Panel`;
    const openPanel = context[fnName as keyof typeof context];

    if (typeof openPanel !== 'function') {
      return null;
    }

    return {
      label: `Add ${singular(currentPagePlugin.navigation?.label || '')}`,
      onClick: () => attemptNavigation(() => (openPanel as (item: any) => void)(null)),
    };
  }, [currentPage, currentPagePlugin, pluginContexts, attemptNavigation]);

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

  // Settings panel state
  const isSettingsPanelOpen = settingsCategory !== null;
  const settingsPanelTitle =
    settingsCategory === 'profile'
      ? 'User Profile'
      : settingsCategory === 'preferences'
        ? 'Preferences'
        : settingsCategory === 'activity-log'
          ? 'Activity Log'
          : settingsCategory === 'profixio'
            ? 'Profixio'
            : 'Settings';

  const settingsPanelContent =
    settingsCategory === 'profile' ? (
      <ProfileSettingsForm
        onCancel={() => {
          setSettingsCategory(null);
        }}
      />
    ) : settingsCategory === 'preferences' ? (
      <PreferencesSettingsForm
        onCancel={() => {
          setSettingsCategory(null);
        }}
      />
    ) : settingsCategory === 'activity-log' ? (
      <ActivityLogForm
        onCancel={() => {
          setSettingsCategory(null);
        }}
      />
    ) : settingsCategory === 'profixio' ? (
      <ProfixioSettingsForm
        onCancel={() => {
          setSettingsCategory(null);
        }}
      />
    ) : null;

  // Use settings panel if settings page is active, otherwise use plugin panel
  const detailPanelOpen = currentPage === 'settings' ? isSettingsPanelOpen : isAnyPanelOpen;
  const detailPanelTitle =
    currentPage === 'settings' ? settingsPanelTitle : panelTitles.getPanelTitle();
  const detailPanelSubtitle = currentPage === 'settings' ? null : panelTitles.getPanelSubtitle();
  const detailPanelContent =
    currentPage === 'settings' ? settingsPanelContent : renderers.renderPanelContent();
  const detailPanelFooter = currentPage === 'settings' ? null : panelFooter;
  const onDetailPanelClose =
    currentPage === 'settings' ? () => setSettingsCategory(null) : handlers.getCloseHandler();

  return (
    <>
      <MainLayout
        currentPage={currentPage}
        onPageChange={handlePageChange}
        contentTitle={contentTitle}
        contentActionLabel={primaryAction?.label}
        onContentAction={primaryAction?.onClick}
        detailPanelOpen={detailPanelOpen}
        detailPanelTitle={detailPanelTitle}
        detailPanelSubtitle={detailPanelSubtitle}
        detailPanelContent={detailPanelContent}
        detailPanelFooter={detailPanelFooter}
        onDetailPanelClose={onDetailPanelClose}
      >
        {currentPage === 'settings' ? (
          <SettingsList
            onCategoryClick={(categoryId) => {
              setSettingsCategory(categoryId);
            }}
          />
        ) : (
          renderers.renderCurrentPage(currentPage, PLUGIN_REGISTRY)
        )}
      </MainLayout>

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
    </>
  );
}

// Main App component
function App() {
  // Initialize theme early to prevent flash of wrong theme
  React.useEffect(() => {
    const stored = localStorage.getItem('theme');
    const root = window.document.documentElement;

    if (
      stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

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
