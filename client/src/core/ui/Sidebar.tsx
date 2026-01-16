import { LogOut, User, Settings } from 'lucide-react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar as useShadcnSidebar,
} from '@/components/ui/sidebar';
import { useApp } from '@/core/api/AppContext';
import { categoryOrder } from '@/core/navigationConfig';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

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
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(new Set());

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

  const handleMenuItemClick = (page: NavPage | null) => {
    if (isMobile) {
      setOpenMobile(false);
    }

    if (page) {
      onPageChange(page);
    }
  };

  const toggleSubmenu = (itemPage: string) => {
    setOpenSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(itemPage)) {
        next.delete(itemPage);
      } else {
        next.add(itemPage);
      }
      return next;
    });
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

  // Auto-open submenu if current page is in a submenu
  useEffect(() => {
    navCategories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.submenu && item.submenu.some((sub: any) => sub.page === currentPage)) {
          setOpenSubmenus((prev) => new Set(prev).add(item.page));
        }
      });
    });
  }, [currentPage, navCategories]);

  return (
    <div className="flex h-full">
      <ShadcnSidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground flex-shrink-0">
              <span className="text-xs font-bold">H</span>
            </div>
            {!isCollapsed && <span className="text-sm font-semibold">Homebase</span>}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {navCategories.map((category, categoryIndex) => (
            <SidebarGroup key={category.title}>
              {categoryIndex > 0 && <div className="h-6" />}
              <SidebarGroupLabel>{category.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {category.items.map((item) => {
                    const isActive = item.page === currentPage;
                    const hasSubmenu = item.submenu && item.submenu.length > 0;
                    const isSubmenuActive =
                      hasSubmenu && item.submenu?.some((sub: any) => sub.page === currentPage);

                    if (hasSubmenu) {
                      const isSubmenuOpen = openSubmenus.has(item.page);
                      return (
                        <Collapsible
                          key={item.label}
                          asChild
                          open={isSubmenuOpen}
                          onOpenChange={() => toggleSubmenu(item.page)}
                        >
                          <SidebarMenuItem>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                isActive={isActive || isSubmenuActive}
                                tooltip={isCollapsed ? item.label : undefined}
                              >
                                <item.icon className="h-3.5 w-3.5" />
                                <span className="text-sm">{item.label}</span>
                                {isSubmenuOpen ? (
                                  <ChevronDown className="ml-auto h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="ml-auto h-3.5 w-3.5" />
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.submenu
                                  ?.sort((a: any, b: any) => a.order - b.order)
                                  .map((subItem: any) => {
                                    const isSubActive = subItem.page === currentPage;
                                    return (
                                      <SidebarMenuSubItem key={subItem.label}>
                                        <SidebarMenuSubButton asChild isActive={isSubActive}>
                                          <button
                                            type="button"
                                            onClick={() => handleMenuItemClick(subItem.page)}
                                            className="w-full"
                                          >
                                            <subItem.icon className="h-3.5 w-3.5" />
                                            <span className="text-sm">{subItem.label}</span>
                                          </button>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </SidebarMenuItem>
                        </Collapsible>
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
                          <item.icon className="h-3.5 w-3.5" />
                          <span className="text-sm">{item.label}</span>
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
            <div className="px-1.5 py-1.5 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{userName || user.email}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{user.role}</div>
                </div>
              </div>
            </div>
          )}
          {user && isCollapsed && (
            <div className="flex justify-center px-1.5 py-1.5 mb-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
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
                <Settings className="h-3.5 w-3.5" />
                <span className="text-sm">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Logout button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                tooltip={isCollapsed ? 'Logout' : undefined}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-sm">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>
    </div>
  );
}
