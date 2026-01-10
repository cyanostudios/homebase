import { ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useApp } from '@/core/api/AppContext';
import { categoryOrder } from '@/core/navigationConfig';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { useSidebar } from './MainLayout';

export type NavPage =
  | 'contacts'
  | 'notes'
  | 'estimates'
  | 'invoices'
  | 'tasks'
  | 'files';

interface SidebarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { isCollapsed, setIsCollapsed, isMobileOverlay, setIsMobileOverlay } = useSidebar();
  const { logout, user } = useApp();
  const [isMobile, setIsMobile] = useState(false);
  const [isHoveringLogo, setIsHoveringLogo] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleMenuItemClick = (page: NavPage | null) => {
    if (isMobile && isMobileOverlay) {
      setIsMobileOverlay(false);
    }
    if (page) {
      onPageChange(page);
    }
  };

  // Build dynamic navigation from active plugins only
  const buildNavigation = () => {
    const categoriesMap = new Map<string, any[]>();

    // Add only plugin items that user has access to
    PLUGIN_REGISTRY.forEach((plugin) => {
      // Only show plugins that user has access to
      if (user?.plugins.includes(plugin.name) && plugin.navigation) {
        const { category, label, icon, order } = plugin.navigation;
        if (!categoriesMap.has(category)) {
          categoriesMap.set(category, []);
        }
        categoriesMap.get(category)!.push({
          type: 'plugin',
          label,
          icon,
          page: plugin.name as NavPage,
          order,
        });
      }
    });

    // Sort items within each category by order
    categoriesMap.forEach((items, category) => {
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

  const showLabels = !isCollapsed || (isMobile && isMobileOverlay);

  return (
    <aside
      className={cn(
        'left-0 top-0 h-screen bg-background border-r flex flex-col transition-all duration-300 z-40',
        isMobile ? 'fixed' : 'sticky',
        isMobile
          ? isMobileOverlay
            ? 'translate-x-0 w-64'
            : '-translate-x-full w-64'
          : isCollapsed
            ? 'w-16'
            : 'w-64'
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-16 items-center border-b px-4",
        isCollapsed && !isMobile ? "justify-center" : "justify-between"
      )}>
        <button
          onClick={() => isCollapsed && setIsCollapsed(false)}
          onMouseEnter={() => setIsHoveringLogo(true)}
          onMouseLeave={() => setIsHoveringLogo(false)}
          disabled={!isCollapsed}
          className={cn(
            "flex items-center gap-2 font-semibold text-left transition-all",
            isCollapsed ? "cursor-pointer hover:scale-110 active:scale-90" : "cursor-default"
          )}
          title={isCollapsed ? "Expand sidebar" : undefined}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0 transition-all duration-300">
            {isCollapsed && isHoveringLogo ? (
              <ChevronRight className="h-5 w-5 animate-in fade-in slide-in-from-left-2 duration-300" />
            ) : (
              <span className="text-sm font-bold">H</span>
            )}
          </div>
          {showLabels && <span className="text-lg">Homebase</span>}
        </button>

        {showLabels && (
          <button
            onClick={() => {
              if (isMobile) {
                setIsMobileOverlay(!isMobileOverlay);
              } else {
                setIsCollapsed(!isCollapsed);
              }
            }}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation with ScrollArea */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <nav className="p-2 space-y-1">
            {navCategories.map((category, categoryIndex) => (
              <div key={category.title} className={cn(categoryIndex > 0 && 'mt-6')}>
                {showLabels && (
                  <div className="mb-2 px-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.title}
                    </h3>
                  </div>
                )}
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const isActive = item.page === currentPage;
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleMenuItemClick(item.page)}
                        disabled={item.page === null}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          isActive && 'bg-accent text-accent-foreground',
                          item.page === null && 'opacity-50 cursor-not-allowed',
                          !showLabels && 'justify-center px-2'
                        )}
                        title={!showLabels ? item.label : undefined}
                      >
                        <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-primary')} />
                        {showLabels && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Footer with Expand/Collapse, User info and Logout */}
      <div className="border-t p-2 space-y-1">

        {/* User info */}
        {user && showLabels && (
          <div className="px-3 py-2 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
              </div>
            </div>
          </div>
        )}
        {user && !showLabels && (
          <div className="flex justify-center px-2 py-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
            'text-destructive hover:bg-destructive/10 transition-colors',
            !showLabels && 'justify-center px-2'
          )}
          title={!showLabels ? 'Logout' : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}