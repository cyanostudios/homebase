import { LogOut, User, Settings } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar as useShadcnSidebar,
} from '@/components/ui/sidebar';
import { useApp } from '@/core/api/AppContext';
import { categoryOrder } from '@/core/navigationConfig';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

import { SecondarySidebar } from './SecondarySidebar';

export type NavPage =
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'invoices'
  | 'invoices-recurring'
  | 'invoices-payments'
  | 'invoices-reports'
  | 'tasks'
  | 'files'
  | 'settings';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { logout, user, getSettings, settingsVersion } = useApp();
  const { state, isMobile, setOpenMobile } = useShadcnSidebar();
  const [userName, setUserName] = useState<string | null>(null);
  const [openSecondarySidebar, setOpenSecondarySidebar] = useState<string | null>(null);

  // Fetch user name from settings
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) {
        return;
      }

      try {
        const response = await getSettings('profile');

        // Handle both response formats
        const settings = response?.settings || response;

        if (settings?.name) {
          setUserName(settings.name);
        } else {
          setUserName(null);
        }
      } catch (error) {
        console.error('Sidebar: Error fetching settings:', error);
        setUserName(null);
      }
    };

    fetchUserName();
  }, [user, getSettings, settingsVersion]);

  const handleLogout = async () => {
    await logout();
  };

  const handleMenuItemClick = (page: NavPage | null, item?: any) => {
    if (isMobile) {
      setOpenMobile(false);
    }

    // If item has submenu, open secondary sidebar instead of navigating
    if (item?.submenu && item.submenu.length > 0) {
      setOpenSecondarySidebar(item.page);
      return;
    }

    if (page) {
      onPageChange(page);
      setOpenSecondarySidebar(null); // Close secondary sidebar when navigating
    }
  };

  // Build dynamic navigation from active plugins only
  const buildNavigation = () => {
    const categoriesMap = new Map<string, any[]>();

    // Add only plugin items that user has access to
    PLUGIN_REGISTRY.forEach((plugin) => {
      // Only show plugins that user has access to
      if (user?.plugins.includes(plugin.name) && plugin.navigation) {
        const { category, label, icon, order, submenu } = plugin.navigation;
        if (!categoriesMap.has(category)) {
          categoriesMap.set(category, []);
        }
        categoriesMap.get(category)!.push({
          type: 'plugin',
          label,
          icon,
          page: plugin.name as NavPage,
          order,
          submenu: submenu?.map((item) => ({
            label: item.label,
            icon: item.icon,
            page: item.page as NavPage,
            order: item.order,
          })),
        });
      }
    });

    // Sort items within each category by order
    categoriesMap.forEach((items) => {
      items.sort((a, b) => a.order - b.order);
    });

    // Build final structure in category order
    return categoryOrder
      .filter((category) => categoriesMap.has(category))
      .map((category) => ({
        title: category,
        items: categoriesMap.get(category)!,
      }));
  };

  const navCategories = buildNavigation();
  const isCollapsed = state === 'collapsed';

  // Find the item with submenu that should be shown in secondary sidebar
  const secondarySidebarItem = navCategories
    .flatMap((cat) => cat.items)
    .find((item) => item.page === openSecondarySidebar && item.submenu);

  return (
    <div className="flex h-full">
      <ShadcnSidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
              <span className="text-sm font-bold">H</span>
            </div>
            {!isCollapsed && <span className="text-lg font-semibold">Homebase</span>}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {navCategories.map((category, categoryIndex) => (
            <SidebarGroup key={category.title}>
              {categoryIndex > 0 && <div className="h-8" />}
              <SidebarGroupLabel>{category.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {category.items.map((item) => {
                    const isActive = item.page === currentPage;
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    const isSubmenuActive =
                      hasSubmenu && item.submenu?.some((sub: any) => sub.page === currentPage);

                    if (hasSubmenu) {
                      return (
                        <SidebarMenuItem key={item.label}>
                          <SidebarMenuButton
                            onClick={() => handleMenuItemClick(item.page, item)}
                            isActive={
                              isActive || isSubmenuActive || openSecondarySidebar === item.page
                            }
                            tooltip={isCollapsed ? item.label : undefined}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            <ChevronRight className="ml-auto h-4 w-4" />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          onClick={() => handleMenuItemClick(item.page)}
                          disabled={item.page === null}
                          isActive={isActive}
                          tooltip={isCollapsed ? item.label : undefined}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          {/* User info */}
          {user && !isCollapsed && (
            <div className="px-2 py-2 mb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{userName || user.email}</div>
                  <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
                </div>
              </div>
            </div>
          )}
          {user && isCollapsed && (
            <div className="flex justify-center px-2 py-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          <SidebarMenu>
            {/* Settings button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => handleMenuItemClick('settings')}
                isActive={currentPage === 'settings'}
                tooltip={isCollapsed ? 'Settings' : undefined}
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Logout button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                tooltip={isCollapsed ? 'Logout' : undefined}
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>

      {/* Secondary Sidebar for submenu items */}
      {secondarySidebarItem && (
        <SecondarySidebar
          isOpen={openSecondarySidebar === secondarySidebarItem.page}
          onClose={() => setOpenSecondarySidebar(null)}
          title={secondarySidebarItem.label}
          items={secondarySidebarItem.submenu || []}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
