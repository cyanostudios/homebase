import { Bell, Filter, Menu, Moon, Search, Sun, X } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { useApp } from '@/core/api/AppContext';
import { PLUGIN_REGISTRY } from '@/core/pluginRegistry';
import { useTheme } from '@/hooks/useTheme';

import { ClockDisplay } from './clock/ClockDisplay';
import { PomodoroTimer } from './pomodoro/PomodoroTimer';
import type { NavPage } from './Sidebar';

interface TopBarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  onOpenMobileNav: () => void;
  detailPanelTitle?: string;
  onDetailPanelClose?: () => void;
}

interface Tenant {
  id: number;
  email: string;
  role: string;
  neon_project_id?: string;
  neon_database_name: string;
  neon_connection_string: string;
}

// Helper function to get user initials from name or email
const getUserInitials = (name: string | undefined, email: string | undefined): string => {
  // First try to use name from settings
  if (name && name.trim().length > 0) {
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      // Use first letter of first and last name
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    // Single name - use first two letters
    if (nameParts[0].length >= 2) {
      return nameParts[0].substring(0, 2).toUpperCase();
    }
    return nameParts[0][0].toUpperCase();
  }

  // Fallback to email if no name
  if (!email) {
    return 'U';
  }
  const localPart = email.split('@')[0];
  const parts = localPart.split(/[._-]/);

  if (parts.length >= 2 && parts[0].length > 0 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  if (localPart.length >= 2) {
    return localPart.substring(0, 2).toUpperCase();
  }

  return localPart[0].toUpperCase();
};

// Helper function to generate a consistent color from email
const getUserColor = (email: string | undefined): string => {
  if (!email) {
    return 'bg-gray-500';
  }

  // Generate a color based on email hash
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Color palette for avatars
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];

  return colors[Math.abs(hash) % colors.length];
};

export function TopBar({
  currentPage,
  onPageChange,
  onOpenMobileNav,
  detailPanelTitle,
  onDetailPanelClose,
}: TopBarProps) {
  const { user, logout, getSettings } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<'pomodoro' | 'clock' | null>(null);
  const [profileSettings, setProfileSettings] = useState<{ name?: string; title?: string } | null>(
    null,
  );

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

  // Load profile settings for name and title
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
      loadProfileSettings();
    }
  }, [user, getSettings]);

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
        setTenants(data.tenants || []); // Ensure it's always an array
      } else {
        setTenants([]); // Set to empty array on error
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
      setTenants([]); // Set to empty array on error
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

  const commandItems = useMemo(() => {
    const items: { label: string; page: NavPage }[] = [{ label: 'Dashboard', page: 'dashboard' }];
    PLUGIN_REGISTRY.forEach((plugin) => {
      if (user?.plugins.includes(plugin.name) && plugin.navigation) {
        items.push({ label: plugin.navigation.label, page: plugin.name as NavPage });
        plugin.navigation.submenu?.forEach((sub) => {
          items.push({ label: sub.label, page: sub.page as NavPage });
        });
      }
    });
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
    <header className="fixed left-0 right-0 top-0 h-14 bg-background border-b border-border z-40">
      <div className="h-full flex items-center justify-between pl-4 pr-2 sm:pr-4 md:pr-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:flex items-center gap-2 ml-8 mr-4 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-xs font-bold">H</span>
            </div>
            <span className="text-sm font-semibold">Homebase</span>
          </div>

          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => onPageChange('dashboard')}>
                    Homebase
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      onClick={() => {
                        if (detailPanelTitle && onDetailPanelClose) {
                          onDetailPanelClose();
                        } else {
                          onPageChange(currentPage);
                        }
                      }}
                      className="hover:underline truncate text-sm sm:text-base"
                    >
                      {pageLabel}
                    </button>
                  </BreadcrumbLink>
                  {detailPanelTitle && onDetailPanelClose && (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-md border border-primary/20 flex-shrink-0">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary"></span>
                      <span className="hidden xs:inline truncate max-w-[100px] sm:max-w-none">
                        {detailPanelTitle}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDetailPanelClose();
                        }}
                        className="ml-0.5 hover:bg-primary/20 rounded p-0.5 transition-colors flex-shrink-0"
                        aria-label="Close detail panel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="h-9 w-9 sm:h-10 sm:w-10"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Filter"
            className="hidden sm:inline-flex h-9 w-9 sm:h-10 sm:w-10"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="hidden md:inline-flex h-9 w-9 sm:h-10 sm:w-10"
          >
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
              <Button
                variant="ghost"
                size="icon"
                aria-label="User menu"
                className="rounded-full h-9 w-9 sm:h-10 sm:w-10"
              >
                <div
                  className={`${getUserColor(user?.email)} text-white text-xs font-semibold rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center`}
                >
                  {getUserInitials(profileSettings?.name, user?.email)}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 min-w-[200px]">
              <DropdownMenuLabel>
                {profileSettings?.name ? (
                  <>
                    <div className="text-sm font-medium">{profileSettings.name}</div>
                    {profileSettings.title && (
                      <div className="text-xs text-muted-foreground">{profileSettings.title}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{user?.email}</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium">{user?.email || 'User'}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {user?.role || 'user'}
                    </div>
                  </>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Switch tenant</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {isLoadingTenants ? (
                      <DropdownMenuItem disabled>Loading tenants...</DropdownMenuItem>
                    ) : !tenants || tenants.length === 0 ? (
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
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                }}
                className="flex items-center justify-between cursor-default"
              >
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
              </DropdownMenuItem>
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
