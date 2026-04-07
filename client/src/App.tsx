/**
 * ⚠️  CRITICAL SYSTEM FILE - HANDLE WITH EXTREME CARE ⚠️
 *
 * This is the main App.tsx file that orchestrates the entire application.
 * It dynamically loads all plugins, manages global state, and handles routing.
 *
 * Last Modified: August 2025 - Global Navigation Guard Integration
 */

import { Settings } from 'lucide-react';
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { resolvePrimaryAction } from '@/core/actions/resolvePrimaryAction';
import { ActionProvider } from '@/core/api/ActionContext';
import { AppProvider, useApp } from '@/core/api/AppContext';
import {
  buildDuplicateDialogOnConfirm,
  buildMatchToSlotOnConfirm,
  buildNoteToTaskOnConfirm,
  getDuplicateDialogConfirmOnly,
  getDuplicateDialogDefaultName,
  getDuplicateDialogNameLabel,
} from '@/core/app/crossPluginDialogHandlers';
import { renderDetailPanelHeaderRight } from '@/core/app/detailPanelHeaderRight';
import { createPanelHandlers } from '@/core/handlers/panelHandlers';
import { createKeyboardHandler } from '@/core/keyboard/keyboardHandlers';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { getSingularCap } from '@/core/pluginSingular';
import { createPanelRenderers } from '@/core/rendering/panelRendering';
import { navPageToPath, pathToNavPage } from '@/core/routing/routeMap';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { Dashboard } from '@/core/ui/Dashboard';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { LoginComponent } from '@/core/ui/LoginComponent';
import { MainLayout } from '@/core/ui/MainLayout';
import { createPanelFooter } from '@/core/ui/PanelFooter';
import { createPanelTitles } from '@/core/ui/PanelTitles';
import type { NavPage } from '@/core/ui/Sidebar'; // <-- viktig typ-import
import { resolveSlug } from '@/core/utils/slugUtils';
import {
  GlobalNavigationGuardProvider,
  useGlobalNavigationGuard,
} from '@/hooks/useGlobalNavigationGuard';
import { PublicEstimateView } from '@/plugins/estimates/components/PublicEstimateView';

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
      const currentItemProperty = `current${getSingularCap(plugin.name)}`;
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
  const { t } = useTranslation();
  const {
    isAuthenticated,
    isLoading,
    registerOpenToTaskDialog,
    registerOpenToSlotDialog,
    closeOtherPanels,
  } = useApp();
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
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showToTaskDialog, setShowToTaskDialog] = useState(false);
  const [deleteNoteAfterTask, setDeleteNoteAfterTask] = useState(false);
  const [noteForTask, setNoteForTask] = useState<{
    id: string;
    title?: string;
    content?: string;
    mentions?: unknown[];
  } | null>(null);
  const [showToSlotDialog, setShowToSlotDialog] = useState(false);
  const [matchForSlot, setMatchForSlot] = useState<{
    id: string;
    home_team: string;
    away_team: string;
    location?: string | null;
    start_time: string;
  } | null>(null);

  // Derive currentPage from URL
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage: NavPage = useMemo(() => pathToNavPage(location.pathname), [location.pathname]);

  // Clear bulk selection in all plugins when user navigates to another page (sidebar)
  // So selection is not cleared when opening view (list unmounts) but is cleared when switching plugin
  useEffect(() => {
    pluginContexts.forEach(({ plugin, context }) => {
      if (!context) {
        return;
      }
      const clearFnName = `clear${getSingularCap(plugin.name)}Selection`;
      const clearFn = context[clearFnName as keyof typeof context];
      if (typeof clearFn === 'function') {
        clearFn();
      }
    });
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps -- pluginContexts is stable from PLUGIN_REGISTRY

  // Register "Create task from note" dialog opener so NoteContext footer can open it
  useEffect(() => {
    registerOpenToTaskDialog((note, options) => {
      setNoteForTask(note);
      setDeleteNoteAfterTask(Boolean(options?.deleteNoteAfter));
      setShowToTaskDialog(true);
    });
    return () => registerOpenToTaskDialog(null);
  }, [registerOpenToTaskDialog]);

  // Register "Create slot from match" dialog opener so MatchContext footer can open it
  useEffect(() => {
    registerOpenToSlotDialog((match) => {
      setMatchForSlot(match);
      setShowToSlotDialog(true);
    });
    return () => registerOpenToSlotDialog(null);
  }, [registerOpenToSlotDialog]);

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

  // Protected page change – navigates to the URL for the given page
  const handlePageChange = useCallback(
    (page: NavPage) => {
      const path = navPageToPath[page];
      // In list view there is no active detail form, so navigation should be immediate.
      if (!isAnyPanelOpen) {
        navigate(path);
        return;
      }

      // Detail panel open: protect navigation with global unsaved-check, then hard-close panels.
      attemptNavigation(() => {
        navigate(path);
        closeOtherPanels();
      });
    },
    [attemptNavigation, closeOtherPanels, isAnyPanelOpen, navigate],
  );

  // Name field used to build/resolve slugs per plugin.
  // Matches are composed from two fields; a function handles those cases.
  const PLUGIN_SLUG_FIELD: Record<string, string | ((i: any) => string)> = {
    notes: 'title',
    contacts: 'companyName',
    tasks: 'title',
    estimates: 'estimateNumber',
    invoices: 'invoiceNumber',
    files: 'name',
    matches: (i: any) => `${i.home_team ?? ''}-vs-${i.away_team ?? ''}`,
    slots: (i: any) => (i.slot_time ? String(i.slot_time).slice(0, 10) : ''),
    mail: 'id',
    pulses: 'id',
    ingest: 'name',
  };

  // URL → panel sync: back/forward button support.
  // When the URL changes to /plugin/slug, open that item's panel.
  // When the URL changes to /plugin (no slug), close the panel.
  // We use `location.pathname` as the dep so this only fires on real URL changes.
  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const pluginName = parts[0];
    const itemSlug = parts[1];

    // Skip non-plugin pages and invoices sub-routes (recurring/payments/reports)
    if (!pluginName || ['dashboard', 'settings'].includes(pluginName)) {
      return;
    }
    if (
      pluginName === 'invoices' &&
      itemSlug &&
      ['recurring', 'payments', 'reports'].includes(itemSlug)
    ) {
      return;
    }

    const pluginEntry = pluginContexts.find(({ plugin }) => plugin.name === pluginName);
    if (!pluginEntry?.context) {
      return;
    }

    const { context, plugin } = pluginEntry;
    const capName = getSingularCap(plugin.name);
    const isOpen = Boolean(context[plugin.panelKey]);
    const currentItem = context[`current${capName}`] as { id?: string | number } | null;
    const nameField = PLUGIN_SLUG_FIELD[plugin.name] ?? 'id';

    if (itemSlug) {
      // URL has a slug – resolve it then open panel if not already showing that item
      const items = (context[plugin.name] as unknown as any[]) ?? [];
      const item = resolveSlug(itemSlug, items, nameField);
      if (item && (!isOpen || String(currentItem?.id) !== String(item.id))) {
        const openFn = context[`open${capName}ForView`] as ((item: any) => void) | undefined;
        if (typeof openFn === 'function') {
          openFn(item);
        }
      }
    } else {
      // URL has no slug – close panel if open
      if (isOpen) {
        const closeFn = context[`close${capName}Panel`] as (() => void) | undefined;
        if (typeof closeFn === 'function') {
          closeFn();
        }
      }
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- pluginContexts is stable

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
    if (
      currentPage === 'dashboard' ||
      currentPage === 'mail' ||
      currentPage === 'pulses' ||
      currentPage === 'slots' ||
      currentPage === 'cups' ||
      currentPage === 'notes' ||
      currentPage === 'contacts' ||
      currentPage === 'tasks' ||
      currentPage === 'matches' ||
      currentPage === 'ingest' ||
      currentPage === 'files' ||
      currentPage === 'estimates'
    ) {
      return '';
    }
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

  const contentIcon = useMemo(() => {
    if (
      currentPage === 'dashboard' ||
      currentPage === 'mail' ||
      currentPage === 'pulses' ||
      currentPage === 'slots' ||
      currentPage === 'cups' ||
      currentPage === 'notes' ||
      currentPage === 'contacts' ||
      currentPage === 'tasks' ||
      currentPage === 'matches' ||
      currentPage === 'ingest' ||
      currentPage === 'files' ||
      currentPage === 'estimates'
    ) {
      return undefined;
    }
    if (currentPage === 'settings') {
      return Settings;
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

  const primaryAction = useMemo(
    () =>
      resolvePrimaryAction(currentPage, currentPagePlugin, pluginContexts, attemptNavigation, t),
    [currentPage, currentPagePlugin, pluginContexts, attemptNavigation, t],
  );

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
    t,
  );

  // Footer with delete handler
  const panelFooter = createPanelFooter(currentMode, currentPluginContext, validationErrors, {
    ...handlers,
    currentPlugin,
    isSubmitting: currentPluginContext?.isSaving ?? false,
  });

  const detailPanelOpen = isAnyPanelOpen;
  const detailPanelTitle = panelTitles.getPanelTitle();
  const detailPanelSubtitle = panelTitles.getPanelSubtitle();
  const detailPanelContent = renderers.renderPanelContent();
  const detailPanelFooter = panelFooter;
  const baseDetailPanelClose = handlers.getCloseHandler();
  const onDetailPanelClose =
    typeof currentPluginContext?.getCloseHandler === 'function' &&
    (currentPlugin?.name === 'tasks' ||
      currentPlugin?.name === 'contacts' ||
      currentPlugin?.name === 'estimates' ||
      currentPlugin?.name === 'slots' ||
      currentPlugin?.name === 'matches')
      ? currentPluginContext.getCloseHandler(baseDetailPanelClose)
      : baseDetailPanelClose;
  const useHeaderActionButtons =
    currentMode === 'view' || currentMode === 'edit' || currentMode === 'create';

  const detailPanelHeaderRight = renderDetailPanelHeaderRight({
    currentMode,
    currentPlugin,
    currentPluginContext,
    currentItem,
    validationErrors,
    onDetailPanelClose,
    handlers,
    t,
  });

  const notePluginContext = pluginContexts.find(({ plugin }) => plugin.name === 'notes')?.context;
  const deleteNoteFromNotesPlugin =
    typeof notePluginContext?.deleteNote === 'function'
      ? (notePluginContext.deleteNote as (id: string) => Promise<void>)
      : undefined;

  return (
    <>
      <MainLayout
        currentPage={currentPage}
        onPageChange={handlePageChange}
        contentTitle={contentTitle}
        contentIcon={contentIcon}
        contentActionLabel={primaryAction?.label}
        contentActionIcon={primaryAction?.icon}
        contentActionVariant={primaryAction?.variant ?? 'primary'}
        onContentAction={primaryAction?.onClick}
        detailPanelOpen={detailPanelOpen}
        detailPanelTitle={detailPanelTitle}
        detailPanelSubtitle={detailPanelSubtitle}
        detailPanelContent={detailPanelContent}
        detailPanelFooter={detailPanelFooter}
        detailPanelHeaderRight={detailPanelHeaderRight}
        detailPanelShowCloseButton={!useHeaderActionButtons}
        onDetailPanelClose={onDetailPanelClose}
        detailPanelPluginName={currentPlugin?.name}
        contentFlush={
          currentPage === 'dashboard' ||
          currentPage === 'slots' ||
          currentPage === 'notes' ||
          currentPage === 'contacts' ||
          currentPage === 'tasks' ||
          currentPage === 'matches' ||
          currentPage === 'ingest' ||
          currentPage === 'mail' ||
          currentPage === 'pulses' ||
          currentPage === 'cups' ||
          currentPage === 'files' ||
          currentPage === 'estimates'
        }
      >
        {currentPage === 'dashboard' ? (
          <Dashboard onPageChange={handlePageChange} />
        ) : (
          renderers.renderCurrentPage(currentPage, PLUGIN_REGISTRY)
        )}
      </MainLayout>

      {/* Global Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title={t('dialog.unsavedChanges')}
        message={warningMessage}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />

      {/* Duplicate Dialog – plugin getDuplicateConfig/executeDuplicate or naming-convention for estimates/invoices */}
      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={buildDuplicateDialogOnConfirm({
          currentPluginContext,
          currentItem,
          currentPlugin,
          setShowDuplicateDialog,
        })}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateDialogDefaultName(
          currentPluginContext,
          currentItem,
          currentPlugin,
        )}
        nameLabel={getDuplicateDialogNameLabel(currentPluginContext, currentItem)}
        confirmOnly={getDuplicateDialogConfirmOnly(
          currentPluginContext,
          currentItem,
          currentPlugin,
        )}
      />

      {/* Create task from note – cross-plugin infrastructure (notes → tasks); kept in App by design */}
      <DuplicateDialog
        isOpen={showToTaskDialog}
        title={
          deleteNoteAfterTask ? t('app.createTaskFromNoteAndDelete') : t('app.createTaskFromNote')
        }
        nameLabel={t('app.taskTitle')}
        confirmText={t('app.create')}
        defaultName={noteForTask?.title ?? ''}
        onConfirm={buildNoteToTaskOnConfirm({
          noteForTask,
          pluginContexts,
          setShowToTaskDialog,
          setNoteForTask,
          attemptNavigation,
          navigate,
          deleteNoteAfter: deleteNoteAfterTask,
          deleteNote: deleteNoteFromNotesPlugin,
          deleteNoteFailedMessage: t('app.taskCreatedNoteDeleteFailed'),
          setDeleteNoteAfterTask,
        })}
        onCancel={() => {
          setShowToTaskDialog(false);
          setNoteForTask(null);
          setDeleteNoteAfterTask(false);
        }}
      />

      {/* Create slot from match – cross-plugin (matches → slots) */}
      <DuplicateDialog
        isOpen={showToSlotDialog}
        title={t('app.createSlotFromMatch')}
        nameLabel=""
        confirmText={t('app.createSlot')}
        defaultName=""
        confirmOnly={true}
        onConfirm={buildMatchToSlotOnConfirm({
          matchForSlot,
          pluginContexts,
          setShowToSlotDialog,
          setMatchForSlot,
          attemptNavigation,
          navigate,
        })}
        onCancel={() => {
          setShowToSlotDialog(false);
          setMatchForSlot(null);
        }}
      />
    </>
  );
}

// Thin wrapper that reads :token from URL and renders the public estimate page
function PublicEstimateRoute() {
  const { token } = useParams<{ token: string }>();
  if (!token) {
    return <div>Invalid link</div>;
  }
  return <PublicEstimateView token={token} />;
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
    <Routes>
      {/* Public routes – no auth / no providers needed */}
      <Route path="/public/estimate/:token" element={<PublicEstimateRoute />} />

      {/* All private routes – wrapped in full provider stack */}
      <Route
        path="/*"
        element={
          <AppProvider>
            <ActionProvider>
              <GlobalNavigationGuardProvider>
                <PluginProviders>
                  <AppContent />
                </PluginProviders>
              </GlobalNavigationGuardProvider>
            </ActionProvider>
          </AppProvider>
        }
      />
    </Routes>
  );
}

export default App;

// Root component: accept HMR but force full reload to avoid "Failed to reload App.tsx"
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
