import { Menu } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { apiFetch, invalidateCsrfToken } from '@/core/api/apiFetch';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { getTopBarWidgets } from '@/core/widgets';
import { useTheme } from '@/hooks/useTheme';

import type { NavPage } from './Sidebar';
import { TopBarBreadcrumbs } from './topbar/TopBarBreadcrumbs';
import { TopBarUserMenu } from './topbar/TopBarUserMenu';
import type { Tenant } from './topbar/types';

interface TopBarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  onOpenMobileNav: () => void;
  detailPanelTitle?: string | React.ReactNode;
  onDetailPanelClose?: () => void;
  detailPanelPluginName?: string;
}

function TopBarInner({
  currentPage,
  onPageChange,
  onOpenMobileNav,
  detailPanelTitle,
  onDetailPanelClose,
  detailPanelPluginName,
}: TopBarProps) {
  const { user, logout, getSettings, settingsVersion } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);
  const [profileSettings, setProfileSettings] = useState<{ name?: string; title?: string } | null>(
    null,
  );
  const [pomodoroClockEnabled, setPomodoroClockEnabled] = useState(true);
  const [timeTrackingEnabled, setTimeTrackingEnabled] = useState(true);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantUserId, setCurrentTenantUserId] = useState<number | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const isAdmin = user?.role === 'superuser';

  const loadCurrentTenant = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setCurrentTenantUserId(data.currentTenantUserId);
      }
    } catch (error) {
      console.error('Failed to load current tenant:', error);
    }
  }, []);

  const loadTenants = useCallback(async () => {
    try {
      setIsLoadingTenants(true);
      const response = await apiFetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      } else {
        setTenants([]);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
      setTenants([]);
    } finally {
      setIsLoadingTenants(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadCurrentTenant();
      void loadTenants();
    }
  }, [isAdmin, loadCurrentTenant, loadTenants]);

  useEffect(() => {
    const loadProfileSettings = async () => {
      try {
        const settings = await getSettings('profile');
        setProfileSettings({
          name: settings?.name,
          title: settings?.title,
        });
      } catch (error) {
        console.error('Failed to load profile settings:', error);
      }
    };

    if (user) {
      void loadProfileSettings();
    }
  }, [user, getSettings]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await getSettings('preferences');
        setPomodoroClockEnabled(prefs?.pomodoroClockEnabled !== false);
        setTimeTrackingEnabled(prefs?.timeTrackingEnabled !== false);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    };

    if (user) {
      void loadPreferences();
    }
  }, [user, getSettings, settingsVersion]);

  const switchTenant = useCallback(async (userId: number) => {
    try {
      const response = await apiFetch('/api/admin/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        invalidateCsrfToken();
        window.location.reload();
      } else {
        console.error('Failed to switch tenant');
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  }, []);

  const pageLabel = useMemo(() => {
    if (currentPage === 'dashboard') {
      return 'Dashboard';
    }
    if (currentPage === 'settings') {
      return 'Settings';
    }

    for (const plugin of PLUGIN_REGISTRY) {
      if (plugin.name === currentPage && plugin.navigation?.label) {
        return plugin.navigation.label;
      }
      const sub = plugin.navigation?.submenu?.find((item) => item.page === currentPage);
      if (sub?.label) {
        return sub.label;
      }
    }

    return currentPage;
  }, [currentPage]);

  const activeBreadcrumbLabel = useMemo(() => {
    if (detailPanelPluginName && detailPanelPluginName !== currentPage) {
      for (const plugin of PLUGIN_REGISTRY) {
        if (plugin.name === detailPanelPluginName && plugin.navigation?.label) {
          return plugin.navigation.label;
        }
      }
    }
    return pageLabel;
  }, [detailPanelPluginName, currentPage, pageLabel]);

  const handleWidgetToggle = useCallback((widgetId: string) => {
    setOpenWidgetId((current) => (current === widgetId ? null : widgetId));
  }, []);

  const handleCloseWidgetPanel = useCallback(() => {
    setOpenWidgetId(null);
  }, []);

  const handleGoDashboard = useCallback(() => {
    onPageChange('dashboard');
  }, [onPageChange]);

  const handleBreadcrumbPrimaryClick = useCallback(() => {
    if (detailPanelTitle && onDetailPanelClose) {
      onDetailPanelClose();
    } else {
      onPageChange(currentPage);
    }
  }, [detailPanelTitle, onDetailPanelClose, onPageChange, currentPage]);

  const handleDetailChipClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDetailPanelClose?.();
    },
    [onDetailPanelClose],
  );

  const handleOpenSettings = useCallback(() => {
    onPageChange('settings');
  }, [onPageChange]);

  const topBarWidgets = useMemo(() => {
    const all = getTopBarWidgets();
    return all.filter((w) => {
      if (w.id === 'pomodoro') {
        return pomodoroClockEnabled;
      }
      if (w.id === 'time-tracking') {
        return timeTrackingEnabled;
      }
      return true;
    });
  }, [pomodoroClockEnabled, timeTrackingEnabled]);

  const widgetToggleById = useMemo(() => {
    const m = new Map<string, () => void>();
    topBarWidgets.forEach((w) => {
      m.set(w.id, () => {
        handleWidgetToggle(w.id);
      });
    });
    return m;
  }, [topBarWidgets, handleWidgetToggle]);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 w-full border-b border-border bg-workspace">
      <div className="flex h-full min-w-0 w-full items-center justify-between pl-3 pr-2 sm:pl-4 sm:pr-4 md:pl-4 md:pr-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0 h-7 w-7"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="mr-4 hidden flex-shrink-0 items-center gap-2 md:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-xs font-bold">H</span>
            </div>
            <span className="text-sm font-semibold">Homebase</span>
          </div>

          <TopBarBreadcrumbs
            activeBreadcrumbLabel={activeBreadcrumbLabel}
            detailPanelTitle={detailPanelTitle}
            onGoDashboard={handleGoDashboard}
            onBreadcrumbPrimaryClick={handleBreadcrumbPrimaryClick}
            onDetailChipClose={handleDetailChipClose}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {topBarWidgets.map((widget) => {
            const WidgetComponent = widget.component;
            return (
              <WidgetComponent
                key={widget.id}
                compact={true}
                isExpanded={openWidgetId === widget.id}
                onToggle={widgetToggleById.get(widget.id)!}
                onClose={handleCloseWidgetPanel}
              />
            );
          })}

          <TopBarUserMenu
            user={user}
            profileSettings={profileSettings}
            isAdmin={isAdmin}
            tenants={tenants}
            isLoadingTenants={isLoadingTenants}
            currentTenantUserId={currentTenantUserId}
            onSwitchTenant={switchTenant}
            onOpenSettings={handleOpenSettings}
            theme={theme}
            toggleTheme={toggleTheme}
            onLogout={logout}
          />
        </div>
      </div>
    </header>
  );
}

TopBarInner.displayName = 'TopBar';

export const TopBar = React.memo(TopBarInner);
