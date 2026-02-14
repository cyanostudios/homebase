/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the main App.tsx file that orchestrates the entire application.
 * It dynamically loads all plugins, manages global state, and handles routing.
 *
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import { Home, Plus } from 'lucide-react';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';

import { ActionProvider } from '@/core/api/ActionContext';
import { AppProvider, useApp } from '@/core/api/AppContext';
import { createPanelHandlers } from '@/core/handlers/panelHandlers';
import { createKeyboardHandler } from '@/core/keyboard/keyboardHandlers';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { createPanelRenderers } from '@/core/rendering/panelRendering';
import type { ExecuteDuplicateResult } from '@/core/types/pluginContract';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Dashboard } from '@/core/ui/Dashboard';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { MainLayout } from '@/core/ui/MainLayout';
import { createPanelFooter } from '@/core/ui/PanelFooter';
import { createPanelTitles } from '@/core/ui/PanelTitles';
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
function findCurrentMode(pluginContexts: any[]): 'create' | 'edit' | 'view' | 'settings' {
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
      if (mode === 'create' || mode === 'edit' || mode === 'view' || mode === 'settings') {
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
  const { isAuthenticated, isLoading, registerOpenToTaskDialog, closeOtherPanels } = useApp();
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
  const pluginContextsRef = useRef(pluginContexts);
  pluginContextsRef.current = pluginContexts;

  // State
  const [isMobileView, setIsMobileView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showToTaskDialog, setShowToTaskDialog] = useState(false);
  const [noteForTask, setNoteForTask] = useState<{
    id: string;
    title?: string;
    content?: string;
    mentions?: unknown[];
  } | null>(null);

  // Initialize currentPage from localStorage, fallback to 'dashboard' (första sidan efter inloggning)
  const [currentPage, setCurrentPage] = useState<NavPage>(() => {
    const saved = localStorage.getItem('homebase:currentPage');
    return (saved as NavPage) || 'dashboard';
  });

  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('homebase:currentPage', currentPage);
  }, [currentPage]);

  // Register "Create task from note" dialog opener so NoteContext footer can open it
  useEffect(() => {
    registerOpenToTaskDialog((note) => {
      setNoteForTask(note);
      setShowToTaskDialog(true);
    });
    return () => registerOpenToTaskDialog(null);
  }, [registerOpenToTaskDialog]);

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
      // In list view there is no active detail form, so navigation should be immediate.
      if (!isAnyPanelOpen) {
        setCurrentPage(page);
        return;
      }

      // Detail panel open: protect navigation with global unsaved-check, then hard-close panels.
      attemptNavigation(() => {
        setCurrentPage(page);
        closeOtherPanels();
      });
    },
    [attemptNavigation, closeOtherPanels, isAnyPanelOpen],
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
    const keyboardHandler = createKeyboardHandler(
      () => pluginContextsRef.current,
      attemptNavigation,
    );
    document.addEventListener('keydown', keyboardHandler);
    return () => document.removeEventListener('keydown', keyboardHandler);
  }, [attemptNavigation]);

  // All hooks must be before early returns
  const currentPagePlugin = useMemo(() => {
    return PLUGIN_REGISTRY.find(
      (plugin) =>
        plugin.name === currentPage ||
        plugin.navigation?.submenu?.some((item) => item.page === currentPage),
    );
  }, [currentPage]);

  const contentTitle = useMemo(() => {
    if (currentPage === 'dashboard') {
      return 'Dashboard';
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

  const contentIcon = useMemo(() => {
    if (currentPage === 'dashboard') {
      return Home;
    }

    if (!currentPagePlugin?.navigation) {
      return undefined;
    }

    if (currentPagePlugin.name === currentPage) {
      return currentPagePlugin.navigation.icon;
    }

    const sub = currentPagePlugin.navigation.submenu?.find((item) => item.page === currentPage);
    return sub?.icon || currentPagePlugin.navigation.icon;
  }, [currentPage, currentPagePlugin]);

  const primaryAction = useMemo(() => {
    if (!currentPagePlugin || currentPagePlugin.name !== currentPage) {
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
      icon: Plus,
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
      handleDuplicateItem: () => {
        const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
        const useFallback =
          currentItem && currentPlugin && currentPlugin.name !== 'contacts' && !config;
        if (config || useFallback) {
          setShowDuplicateDialog(true);
        }
      },
      handleEditItem: handlers.handleEditItem,
      isSubmitting: currentPluginContext?.isSaving ?? false,
    },
  );

  const detailPanelOpen = isAnyPanelOpen;
  const detailPanelTitle = panelTitles.getPanelTitle();
  const detailPanelSubtitle = panelTitles.getPanelSubtitle();
  const detailPanelContent = renderers.renderPanelContent();
  const detailPanelFooter = panelFooter;
  const onDetailPanelClose = handlers.getCloseHandler();

  return (
    <>
      <MainLayout
        currentPage={currentPage}
        onPageChange={handlePageChange}
        contentTitle={contentTitle}
        contentIcon={contentIcon}
        contentActionLabel={primaryAction?.label}
        contentActionIcon={primaryAction?.icon}
        onContentAction={primaryAction?.onClick}
        detailPanelOpen={detailPanelOpen}
        detailPanelTitle={detailPanelTitle}
        detailPanelSubtitle={detailPanelSubtitle}
        detailPanelContent={detailPanelContent}
        detailPanelFooter={detailPanelFooter}
        onDetailPanelClose={onDetailPanelClose}
        detailPanelPluginName={currentPlugin?.name}
      >
        {currentPage === 'dashboard' ? (
          <Dashboard onPageChange={handlePageChange} />
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

      {/* Duplicate Dialog – uses plugin contract (getDuplicateConfig / executeDuplicate) or fallback for estimates/invoices */}
      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          if (!currentPluginContext || !currentItem) {
            setShowDuplicateDialog(false);
            return;
          }
          const executeDuplicate = currentPluginContext.executeDuplicate;
          if (typeof executeDuplicate === 'function') {
            executeDuplicate(currentItem, newName)
              .then(({ closePanel, highlightId }: ExecuteDuplicateResult) => {
                closePanel();
                if (highlightId !== undefined && highlightId !== null) {
                  if (typeof currentPluginContext.setRecentlyDuplicatedNoteId === 'function') {
                    currentPluginContext.setRecentlyDuplicatedNoteId(highlightId);
                  }
                  if (typeof currentPluginContext.setRecentlyDuplicatedTaskId === 'function') {
                    currentPluginContext.setRecentlyDuplicatedTaskId(highlightId);
                  }
                }
                setShowDuplicateDialog(false);
              })
              .catch((err: unknown) => {
                setShowDuplicateDialog(false);
                alert(
                  (err as { message?: string; error?: string })?.message ??
                    (err as { message?: string; error?: string })?.error ??
                    'Failed to duplicate.',
                );
              });
            return;
          }
          // Fallback: other plugins (estimates, invoices, etc.) by naming convention
          const itemCopy = { ...currentItem };
          delete itemCopy.id;
          delete itemCopy.createdAt;
          delete itemCopy.updatedAt;
          if (currentPlugin) {
            const pluginNameSingular = currentPlugin.name.endsWith('s')
              ? currentPlugin.name.slice(0, -1)
              : currentPlugin.name;
            const createFnName = `create${pluginNameSingular.charAt(0).toUpperCase() + pluginNameSingular.slice(1)}`;
            const closeFnName = `close${pluginNameSingular.charAt(0).toUpperCase() + pluginNameSingular.slice(1)}Panel`;
            const createFn = currentPluginContext[createFnName];
            const closeFn = currentPluginContext[closeFnName];
            if (createFn && closeFn) {
              createFn(itemCopy)
                .then(() => {
                  closeFn();
                  setShowDuplicateDialog(false);
                })
                .catch((err: unknown) => {
                  setShowDuplicateDialog(false);
                  alert(
                    (err as { message?: string; error?: string })?.message ??
                      (err as { message?: string; error?: string })?.error ??
                      'Failed to duplicate.',
                  );
                });
            } else {
              console.warn(`Create or close function not found for plugin: ${currentPlugin.name}`);
              setShowDuplicateDialog(false);
            }
          } else {
            setShowDuplicateDialog(false);
          }
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={(() => {
          const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
          if (config) {
            return config.defaultName;
          }
          if (currentItem && currentPlugin && currentPlugin.name !== 'contacts') {
            return '';
          }
          return '';
        })()}
        nameLabel={(() => {
          const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
          if (config) {
            return config.nameLabel;
          }
          return 'Name';
        })()}
        confirmOnly={(() => {
          const config = currentPluginContext?.getDuplicateConfig?.(currentItem);
          if (config && config.confirmOnly !== undefined) {
            return config.confirmOnly;
          }
          return currentPlugin?.name === 'estimates' || currentPlugin?.name === 'invoices';
        })()}
      />

      {/* Create task from note – cross-plugin infrastructure (notes → tasks); kept in App by design */}
      <DuplicateDialog
        isOpen={showToTaskDialog}
        title="Create task from note"
        nameLabel="Task title"
        confirmText="Create"
        defaultName={noteForTask?.title ?? ''}
        onConfirm={(newName) => {
          if (!noteForTask) {
            setShowToTaskDialog(false);
            setNoteForTask(null);
            return;
          }
          const taskEntry = pluginContexts.find(({ plugin }) => plugin.name === 'tasks');
          const noteEntry = pluginContexts.find(({ plugin }) => plugin.name === 'notes');
          const taskContext = taskEntry?.context;
          const noteContext = noteEntry?.context;
          const createTask = taskContext?.createTask;
          const closeNotePanel = noteContext?.closeNotePanel;
          const setRecentlyDuplicatedTaskId = taskContext?.setRecentlyDuplicatedTaskId;
          if (typeof createTask !== 'function' || typeof closeNotePanel !== 'function') {
            setShowToTaskDialog(false);
            setNoteForTask(null);
            return;
          }
          const payload = {
            title: newName.trim() || 'Untitled',
            content: noteForTask.content ?? '',
            mentions: noteForTask.mentions ?? [],
            status: 'not started',
            priority: 'Medium',
            dueDate: null,
            assignedTo: null,
            createdFromNote: noteForTask.id,
          };
          createTask(payload)
            .then((newTask: { id?: string | number } | undefined) => {
              closeNotePanel();
              attemptNavigation(() => setCurrentPage('tasks'));
              if (
                newTask?.id !== undefined &&
                newTask?.id !== null &&
                typeof setRecentlyDuplicatedTaskId === 'function'
              ) {
                setRecentlyDuplicatedTaskId(String(newTask.id));
              }
              setShowToTaskDialog(false);
              setNoteForTask(null);
            })
            .catch((err: unknown) => {
              setShowToTaskDialog(false);
              setNoteForTask(null);
              alert(
                (err as { message?: string; error?: string })?.message ??
                  (err as { message?: string; error?: string })?.error ??
                  'Failed to create task from note.',
              );
            });
        }}
        onCancel={() => {
          setShowToTaskDialog(false);
          setNoteForTask(null);
        }}
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
      <ActionProvider>
        <GlobalNavigationGuardProvider>
          <PluginProviders>
            <AppContent />
          </PluginProviders>
        </GlobalNavigationGuardProvider>
      </ActionProvider>
    </AppProvider>
  );
}

export default App;
