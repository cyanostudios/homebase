import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/core/api/AppContext';
import { UserAvatarButton } from '@/core/ui/rightSidebar/UserAvatarButton';

/** Phone/pad account menu. Desktop uses the right-rail user flyout. */
export const MobileUserMenu = React.memo(function MobileUserMenu({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const { user, logout, getSettings } = useApp();
  const [profileSettings, setProfileSettings] = useState<{ name?: string; title?: string } | null>(
    null,
  );

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UserAvatarButton className="h-7 w-7 min-w-7 text-xs" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 min-w-[200px]">
        <DropdownMenuLabel>
          {profileSettings?.name ? (
            <>
              <div className="text-sm font-medium">{profileSettings.name}</div>
              {profileSettings.title && (
                <div className="text-xs text-muted-foreground">{profileSettings.title}</div>
              )}
              <div className="mt-1 text-xs text-muted-foreground">{user?.email}</div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium">{user?.email || 'User'}</div>
              <div className="text-xs capitalize text-muted-foreground">{user?.role || 'user'}</div>
            </>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings}>{t('nav.settings')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          {t('rightSidebar.logOut', { defaultValue: 'Log out' })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
