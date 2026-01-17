import { Bell, Filter, Menu, Search, Settings, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';

import { ClockDisplay } from './clock/ClockDisplay';
import { PomodoroTimer } from './pomodoro/PomodoroTimer';
import type { NavPage } from './Sidebar';

interface TopBarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  onOpenMobileNav: () => void;
}

interface Tenant {
  id: number;
  email: string;
  role: string;
  neon_project_id?: string;
  neon_database_name: string;
  neon_connection_string: string;
}

export function TopBar({ currentPage, onPageChange, onOpenMobileNav }: TopBarProps) {
  const { user, logout } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<'pomodoro' | 'clock' | null>(null);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantUserId, setCurrentTenantUserId] = useState<number | null>(null);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const isAdmin = user?.role === 'superuser';

  useEffect(() => {
    if (isAdmin) {
      loadCurrentTenant();
      loadTenants();
    }
  }, [isAdmin]);

  const loadCurrentTenant = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setCurrentTenantUserId(data.currentTenantUserId);
      }
    } catch (error) {
      console.error('Failed to load current tenant:', error);
    }
  };

  const loadTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const response = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const switchTenant = async (userId: number) => {
    try {
      const response = await fetch('/api/admin/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        console.error('Failed to switch tenant');
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
    }
  };

  const pageLabel = useMemo(() => {
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

  const commandItems = useMemo(() => {
    const items: { label: string; page: NavPage }[] = [];
    PLUGIN_REGISTRY.forEach((plugin) => {
      if (user?.plugins.includes(plugin.name) && plugin.navigation) {
        items.push({ label: plugin.navigation.label, page: plugin.name as NavPage });
        plugin.navigation.submenu?.forEach((sub) => {
          items.push({ label: sub.label, page: sub.page as NavPage });
        });
      }
    });
    items.push({ label: 'Settings', page: 'settings' });
    return items;
  }, [user]);

  const handleCommandSelect = (page: NavPage) => {
    onPageChange(page);
    setSearchOpen(false);
  };

  const handlePanelToggle = (panel: 'pomodoro' | 'clock') => {
    setOpenPanel(openPanel === panel ? null : panel);
  };

  const handleClosePanel = () => {
    setOpenPanel(null);
  };

  return (
    <header className="fixed left-0 right-0 top-0 h-14 bg-background border-b border-border z-20">
      <div className="h-full flex items-center justify-between pl-4 pr-4 sm:pr-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:flex items-center gap-2 ml-8 mr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-xs font-bold">H</span>
            </div>
            <span className="text-sm font-semibold">Homebase</span>
          </div>

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => onPageChange('contacts')}>
                    Homebase
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Filter">
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => onPageChange('settings')}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>

          <PomodoroTimer
            compact={true}
            isExpanded={openPanel === 'pomodoro'}
            onToggle={() => handlePanelToggle('pomodoro')}
            onClose={handleClosePanel}
          />

          <ClockDisplay
            compact={true}
            isExpanded={openPanel === 'clock'}
            onToggle={() => handlePanelToggle('clock')}
            onClose={handleClosePanel}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="User menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user?.email || 'User'}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {user?.role || 'user'}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Switch tenant</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {isLoadingTenants ? (
                      <DropdownMenuItem disabled>Loading tenants...</DropdownMenuItem>
                    ) : tenants.length === 0 ? (
                      <DropdownMenuItem disabled>No tenants found</DropdownMenuItem>
                    ) : (
                      tenants.map((tenant) => (
                        <DropdownMenuItem
                          key={tenant.id}
                          onClick={() => switchTenant(tenant.id)}
                          className={currentTenantUserId === tenant.id ? 'bg-accent' : undefined}
                        >
                          <span className="truncate">{tenant.email}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuItem onClick={() => onPageChange('settings')}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
          <SheetContent side="top" className="p-0">
            <SheetHeader className="px-4 pt-4">
              <SheetTitle>Search</SheetTitle>
            </SheetHeader>
            <div className="p-4">
              <Command>
                <CommandInput placeholder="Search pages..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup heading="Pages">
                    {commandItems.map((item) => (
                      <CommandItem
                        key={`${item.page}-${item.label}`}
                        onSelect={() => handleCommandSelect(item.page)}
                      >
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </CommandList>
              </Command>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
