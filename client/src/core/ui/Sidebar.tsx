import { ChevronDown, ChevronRight, Home, LogOut, Settings } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useApp } from '@/core/api/AppContext';
import { categoryOrder } from '@/core/navigationConfig';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { cn } from '@/lib/utils';

// Plugin icon colors for normal state (non-active)
// Colors based on actual usage in plugin context files and components
const PLUGIN_ICON_COLORS: Record<string, string> = {
  contacts: 'text-blue-600 dark:text-blue-400', // #2563eb from ContactContext.tsx
  notes: 'text-yellow-600 dark:text-yellow-400', // #ca8a04 from NoteContext.tsx
  tasks: 'text-purple-500 dark:text-purple-400', // from TaskList.tsx
  estimates: 'text-blue-600 dark:text-blue-400', // #2563eb from EstimateContext.tsx
  invoices: 'text-primary', // No specific color found, uses primary
  files: 'text-muted-foreground', // No specific color found, uses muted
  mail: 'text-muted-foreground',
  inspection: 'text-amber-600 dark:text-amber-400',
  orders: 'text-emerald-600 dark:text-emerald-400',
  analytics: 'text-cyan-600 dark:text-cyan-400',
};

export type NavPage =
  | 'dashboard'
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'invoices'
  | 'invoices-recurring'
  | 'invoices-payments'
  | 'invoices-reports'
  | 'tasks'
  | 'files'
  | 'mail'
  | 'inspection'
  | 'channels'
  | 'products'
  | 'products-import'
  | 'products-export'
  | 'woocommerce-products'
  | 'cdon-products'
  | 'fyndiq-products'
  | 'orders'
  | 'shipping'
  | 'analytics'
  | 'settings';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  currentPage,
  onPageChange,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const { logout, user } = useApp();
  const [isMobile, setIsMobile] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(new Set());

  const navCategories = useMemo(() => {
    const categoriesMap = new Map<string, any[]>();
    const plugins = user?.plugins ?? [];

    PLUGIN_REGISTRY.forEach((plugin) => {
      if (!plugins.includes(plugin.name) || !plugin.navigation) {
        return;
      }
      if (plugin.navigation.hideFromSidebar) {
        return;
      }

      const { category, label, icon, order, submenu, badge } = plugin.navigation;
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      const filteredSubmenu = submenu
        ?.filter((item) => plugins.includes(item.page))
        ?.map((item) => ({
          label: item.label,
          icon: item.icon,
          page: item.page as NavPage,
          order: item.order,
        }));
      categoriesMap.get(category)!.push({
        label,
        icon,
        page: plugin.name as NavPage,
        order,
        badge,
        submenu: filteredSubmenu,
      });
    });

    categoriesMap.forEach((items) => {
      items.sort((a, b) => a.order - b.order);
    });

    const dashboardItem = {
      label: 'Dashboard',
      icon: Home,
      page: 'dashboard' as NavPage,
      order: 0,
    };
    return categoryOrder
      .filter((category) => categoriesMap.has(category))
      .map((category) => {
        const items =
          category === 'Main'
            ? [dashboardItem, ...(categoriesMap.get(category) ?? [])].sort(
                (a, b) => a.order - b.order,
              )
            : categoriesMap.get(category)!;
        return { title: category, items };
      });
  }, [user]);

  // Auto-open submenu if current page is a submenu item
  useEffect(() => {
    setOpenSubmenus((prev) => {
      const next = new Set(prev);
      navCategories.forEach((category) => {
        category.items.forEach((item) => {
          if (item.submenu?.some((sub: any) => sub.page === currentPage)) {
            next.add(item.label);
          }
        });
      });
      return next;
    });
  }, [currentPage, navCategories]);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleMenuItemClick = (page: NavPage | null) => {
    if (isMobile) {
      onMobileOpenChange(false);
    }

    if (page) {
      onPageChange(page);
    }
  };

  const toggleSubmenu = (itemLabel: string) => {
    setOpenSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(itemLabel)) {
        next.delete(itemLabel);
      } else {
        next.add(itemLabel);
      }
      return next;
    });
  };

  const renderNavItem = (item: any) => {
    const Icon = item.icon;
    const isActive =
      item.page === currentPage ||
      item.submenu?.some((sub: any) => sub.page === currentPage) ||
      ((currentPage === 'products-import' || currentPage === 'products-export') &&
        item.page === 'products');
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isSubmenuOpen = openSubmenus.has(item.label);

    const buttonClass = cn(
      'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
      'justify-start',
      'text-muted-foreground hover:text-foreground hover:bg-accent',
    );

    const content = (
      <div className={buttonClass}>
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0',
            isActive ? 'text-primary' : PLUGIN_ICON_COLORS[item.page] || 'text-muted-foreground',
          )}
        />
        <span className={cn('truncate', isActive ? 'text-primary font-medium' : '')}>
          {item.label}
        </span>
        {item.badge && (
          <Badge variant={item.badge.variant} className="ml-auto">
            {item.badge.label}
          </Badge>
        )}
        {hasSubmenu &&
          (isSubmenuOpen ? (
            <ChevronDown className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
          ) : (
            <ChevronRight className={cn('h-3.5 w-3.5', item.badge ? '' : 'ml-auto')} />
          ))}
      </div>
    );

    if (hasSubmenu) {
      return (
        <NavigationMenuItem key={item.label}>
          <Collapsible open={isSubmenuOpen} onOpenChange={() => toggleSubmenu(item.label)}>
            <CollapsibleTrigger asChild>
              <button type="button" className="w-full">
                {content}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-6 pt-1 pb-1 space-y-1">
                {item.submenu
                  ?.sort((a: any, b: any) => a.order - b.order)
                  .map((subItem: any) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = subItem.page === currentPage;
                    return (
                      <button
                        key={subItem.label}
                        type="button"
                        onClick={() => handleMenuItemClick(subItem.page)}
                        className={cn(
                          'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                          'text-muted-foreground hover:text-foreground hover:bg-accent',
                        )}
                      >
                        <SubIcon
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            isSubActive ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <span
                          className={cn('truncate', isSubActive ? 'text-primary font-medium' : '')}
                        >
                          {subItem.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </NavigationMenuItem>
      );
    }

    const link = (
      <NavigationMenuLink asChild>
        <button type="button" onClick={() => handleMenuItemClick(item.page)}>
          {content}
        </button>
      </NavigationMenuLink>
    );

    return <NavigationMenuItem key={item.label}>{link}</NavigationMenuItem>;
  };

  const renderCategories = () => (
    <div className="flex flex-col gap-4">
      {navCategories.map((category) => (
        <div key={category.title}>
          <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category.title}
          </div>
          <NavigationMenu className="w-full max-w-full justify-start">
            <NavigationMenuList className="flex-col items-stretch">
              {category.items.map((item: any) => renderNavItem(item))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      ))}
    </div>
  );

  const renderFooterActions = () => (
    <NavigationMenu className="w-full max-w-full justify-start">
      <NavigationMenuList className="flex-col items-stretch">
        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <button type="button" onClick={() => handleMenuItemClick('settings')}>
              <div
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                  'justify-start',
                  'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <Settings
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    currentPage === 'settings' ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span className={cn(currentPage === 'settings' ? 'text-primary font-medium' : '')}>
                  Settings
                </span>
              </div>
            </button>
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink asChild>
            <button type="button" onClick={handleLogout}>
              <div
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors text-destructive hover:bg-destructive/10',
                  'justify-start',
                )}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span>Logout</span>
              </div>
            </button>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col pt-14">
      <div className="flex-1 overflow-y-auto px-2 pt-4">{renderCategories()}</div>

      <div className="px-2 pb-4">{renderFooterActions()}</div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] flex-shrink-0 bg-muted z-10 ml-8">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
