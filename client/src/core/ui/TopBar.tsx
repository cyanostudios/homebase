import { Menu } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

import type { NavPage } from '@/core/navigation/navTypes';
import { TopBarBreadcrumbs } from './topbar/TopBarBreadcrumbs';
import { TopBarUserMenu } from './topbar/TopBarUserMenu';

interface TopBarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  onOpenMobileNav: () => void;
  /** Breadcrumb chip label only — must be a plain string, never action UI. */
  detailPanelTitle?: string;
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
  const { organizationName, organizationLogoUrl } = useApp();

  const brandName = organizationName.trim() || 'Homebase';
  const brandInitial = (brandName.charAt(0) || 'H').toUpperCase();

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

          {/* User menu: phone/pad only — desktop uses AppRightSidebar */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:hidden">
            <TopBarUserMenu onOpenSettings={handleOpenSettings} />
          </div>
        </div>
      </header>

      {/* Flow spacer matching fixed header height */}
      <div className="h-14 w-full shrink-0" aria-hidden />
    </>
  );
}

TopBarInner.displayName = 'TopBar';

export const TopBar = React.memo(TopBarInner);
