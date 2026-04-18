import { Moon, Sun } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';

import { getUserColor, getUserInitials } from './helpers';
import type { Tenant } from './types';

export const TopBarUserMenu = React.memo(function TopBarUserMenu({
  user,
  profileSettings,
  isAdmin,
  tenants,
  isLoadingTenants,
  currentTenantUserId,
  onSwitchTenant,
  onOpenSettings,
  theme,
  toggleTheme,
  onLogout,
}: {
  user: { email?: string; role?: string } | null | undefined;
  profileSettings: { name?: string; title?: string } | null;
  isAdmin: boolean;
  tenants: Tenant[];
  isLoadingTenants: boolean;
  currentTenantUserId: number | null;
  onSwitchTenant: (userId: number) => void;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onLogout: () => void;
}) {
  const tenantSwitchById = useMemo(() => {
    const m = new Map<number, () => void>();
    tenants.forEach((t) => {
      m.set(t.id, () => {
        onSwitchTenant(t.id);
      });
    });
    return m;
  }, [tenants, onSwitchTenant]);

  const onThemeRowSelect = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="User menu" className="rounded-full h-7 w-7">
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
              <div className="text-xs text-muted-foreground capitalize">{user?.role || 'user'}</div>
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
                    onClick={tenantSwitchById.get(tenant.id)!}
                    className={currentTenantUserId === tenant.id ? 'bg-accent' : undefined}
                  >
                    <span className="truncate">{tenant.email}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onClick={onOpenSettings}>Settings</DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onThemeRowSelect}
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
        <DropdownMenuItem onClick={onLogout} className="text-destructive">
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
