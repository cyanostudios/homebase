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
import { getTopBarWidgets } from '@/core/widgets';
import { useTheme } from '@/hooks/useTheme';

import type { NavPage } from './Sidebar';

interface TopBarProps {
  currentPage: NavPage;
  onPageChange: (page: NavPage) => void;
  onOpenMobileNav: () => void;
  detailPanelTitle?: string | React.ReactNode;
  onDetailPanelClose?: () => void;
  detailPanelPluginName?: string;
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
  detailPanelPluginName,
}: TopBarProps) {
  const { user, logout, getSettings, settingsVersion } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Load preferences (Pomodoro clock, Time tracking on/off)
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
      loadPreferences();
    }
  }, [user, getSettings, settingsVersion]);

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

  // When a detail panel is open from a different plugin, show that plugin's label
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

  const commandItems = useMemo(() => {
    const items: { label: string; page: NavPage }[] = [{ label: 'Dashboard', page: 'dashboard' }];
    PLUGIN_REGISTRY.forEach((plugin) => {
      const isEnabled = plugin.name === 'settings' || (user?.plugins ?? []).includes(plugin.name);
      if (isEnabled && plugin.navigation) {
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

  const handleWidgetToggle = (widgetId: string) => {
    setOpenWidgetId((current) => (current === widgetId ? null : widgetId));
  };

  const handleCloseWidgetPanel = () => {
    setOpenWidgetId(null);
  };

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

          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-wrap">
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Button
                    variant="link"
                    type="button"
                    onClick={() => onPageChange('dashboard')}
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:no-underline font-normal"
                  >
                    Homebase
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <BreadcrumbLink asChild>
                    <Button
                      variant="link"
                      type="button"
                      onClick={() => {
                        if (detailPanelTitle && onDetailPanelClose) {
                          onDetailPanelClose();
                        } else {
                          onPageChange(currentPage);
                        }
                      }}
                      className="h-auto p-0 hover:no-underline truncate text-xs font-medium text-foreground min-w-0"
                    >
                      {activeBreadcrumbLabel}
                    </Button>
                  </BreadcrumbLink>
                  {detailPanelTitle && onDetailPanelClose && (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 min-w-0 px-1.5 sm:px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-md border border-primary/20">
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary flex-shrink-0"></span>
                      <span className="truncate max-w-[120px] sm:max-w-[200px]">
                        {detailPanelTitle}
                      </span>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDetailPanelClose();
                        }}
                        className="ml-0.5 h-6 w-6 p-0 hover:bg-primary/20 rounded transition-colors flex-shrink-0"
                        aria-label="Close detail panel"
                      >
                        <X className="h-3 w-3" />
                      </Button>
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
            className="h-7 w-7"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Filter"
            className="hidden sm:inline-flex h-7 w-7"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="hidden md:inline-flex h-7 w-7"
          >
            <Bell className="h-4 w-4" />
          </Button>

          {topBarWidgets.map((widget) => {
            const WidgetComponent = widget.component;
            return (
              <WidgetComponent
                key={widget.id}
                compact={true}
                isExpanded={openWidgetId === widget.id}
                onToggle={() => handleWidgetToggle(widget.id)}
                onClose={handleCloseWidgetPanel}
              />
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="User menu"
                className="rounded-full h-7 w-7"
              >
                <div
                  className={`${getUserColor(user?.email)} text-white text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center`}
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
                  <DropdownMenuSubTrigger>Switch account</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    {isLoadingTenants ? (
                      <DropdownMenuItem disabled>Loading accounts...</DropdownMenuItem>
                    ) : !tenants || tenants.length === 0 ? (
                      <DropdownMenuItem disabled>No accounts found</DropdownMenuItem>
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
