import { Menu } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { getTopBarWidgets } from '@/core/widgets';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

import type { NavPage } from '@/core/navigation/navTypes';
import { TopBarBreadcrumbs } from './topbar/TopBarBreadcrumbs';
import { TopBarUserMenu } from './topbar/TopBarUserMenu';

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
  const { user, logout, getSettings, settingsVersion, organizationName, organizationLogoUrl } =
    useApp();
  const { theme, toggleTheme } = useTheme();
  const [openWidgetId, setOpenWidgetId] = useState<string | null>(null);
  const [profileSettings, setProfileSettings] = useState<{ name?: string; title?: string } | null>(
    null,
  );
  const [pomodoroClockEnabled, setPomodoroClockEnabled] = useState(true);
  const [timeTrackingEnabled, setTimeTrackingEnabled] = useState(true);

  const brandName = organizationName.trim() || 'Homebase';
  const brandInitial = (brandName.charAt(0) || 'H').toUpperCase();

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

  const clockWidgets = useMemo(
    () => topBarWidgets.filter((w) => w.id === 'clock'),
    [topBarWidgets],
  );
  const toolWidgets = useMemo(
    () => topBarWidgets.filter((w) => w.id === 'pomodoro' || w.id === 'time-tracking'),
    [topBarWidgets],
  );
  const otherWidgets = useMemo(
    () =>
      topBarWidgets.filter(
        (w) => w.id !== 'clock' && w.id !== 'pomodoro' && w.id !== 'time-tracking',
      ),
    [topBarWidgets],
  );

  const showMobileToolRow = toolWidgets.length > 0;

  const renderWidgetList = (
    widgets: typeof topBarWidgets,
    className?: string,
    itemClassName?: string,
  ) => (
    <div className={cn('flex items-center gap-1 sm:gap-2', className)}>
      {widgets.map((widget) => {
        const WidgetComponent = widget.component;
        return (
          <div key={widget.id} className={itemClassName}>
            <WidgetComponent
              compact={true}
              isExpanded={openWidgetId === widget.id}
              onToggle={widgetToggleById.get(widget.id)!}
              onClose={handleCloseWidgetPanel}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-40 flex w-full flex-col bg-workspace">
        <div className="flex h-14 min-w-0 w-full items-center justify-between pl-3 pr-2 sm:pl-4 sm:pr-4 md:pl-4 md:pr-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0 lg:hidden"
              onClick={onOpenMobileNav}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="mr-4 hidden flex-shrink-0 items-center gap-2 lg:flex">
              {organizationLogoUrl ? (
                <img
                  src={organizationLogoUrl}
                  alt=""
                  className="h-8 w-8 rounded-md bg-muted/40 object-contain"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <span className="text-xs font-bold">{brandInitial}</span>
                </div>
              )}
              <span className="text-sm font-semibold">{brandName}</span>
            </div>

            <TopBarBreadcrumbs
              brandLabel={brandName}
              activeBreadcrumbLabel={activeBreadcrumbLabel}
              detailPanelTitle={detailPanelTitle}
              onGoDashboard={handleGoDashboard}
              onBreadcrumbPrimaryClick={handleBreadcrumbPrimaryClick}
              onDetailChipClose={handleDetailChipClose}
            />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Mobile: clock (and any other non-tool widgets) stay in the top row */}
            {renderWidgetList([...clockWidgets, ...otherWidgets], 'flex md:hidden')}
            {/* Desktop: all widgets in the top row */}
            {renderWidgetList(topBarWidgets, 'hidden md:flex')}
            <TopBarUserMenu
              user={user}
              profileSettings={profileSettings}
              onOpenSettings={handleOpenSettings}
              theme={theme}
              toggleTheme={toggleTheme}
              onLogout={logout}
            />
          </div>
        </div>

        {showMobileToolRow ? (
          <div className="flex h-12 items-center gap-2 border-t border-border/40 px-3 md:hidden sm:px-4">
            {renderWidgetList(
              toolWidgets,
              'flex w-full min-w-0 gap-2',
              'min-w-0 flex-1 [&>div]:w-full',
            )}
          </div>
        ) : null}
      </header>

      {/* Flow spacer matching fixed header height */}
      <div
        className={cn('w-full shrink-0', showMobileToolRow ? 'h-[6.5rem] md:h-14' : 'h-14')}
        aria-hidden
      />
    </>
  );
}

TopBarInner.displayName = 'TopBar';

export const TopBar = React.memo(TopBarInner);
