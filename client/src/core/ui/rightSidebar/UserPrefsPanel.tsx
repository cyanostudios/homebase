import { LogOut } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { useApp } from '@/core/api/AppContext';
import { getSidebarOrganizationLines } from '@/core/api/organizationApi';

export function UserPrefsPanel() {
  const { t } = useTranslation();
  const { user, logout, getSettings, organizationProfile } = useApp();
  const [profileSettings, setProfileSettings] = useState<{ name?: string; title?: string } | null>(
    null,
  );

  const orgLines = useMemo(
    () => getSidebarOrganizationLines(organizationProfile),
    [organizationProfile],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await getSettings('profile');
        setProfileSettings({ name: settings?.name, title: settings?.title });
      } catch (error) {
        console.error('Failed to load profile settings:', error);
      }
    };
    if (user) {
      void load();
    }
  }, [user, getSettings]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        {profileSettings?.name ? (
          <>
            <p className="text-sm font-extrabold text-foreground">{profileSettings.name}</p>
            {profileSettings.title ? (
              <p className="text-xs text-muted-foreground">{profileSettings.title}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-extrabold text-foreground">{user?.email || 'User'}</p>
            <p className="text-xs capitalize text-muted-foreground">{user?.role || 'user'}</p>
          </>
        )}
      </div>

      {orgLines.hasContent ? (
        <div className="space-y-1.5 text-xs leading-snug text-muted-foreground">
          {orgLines.orgNumber ? <p className="truncate">Org.nr {orgLines.orgNumber}</p> : null}

          {orgLines.addressLines.map((line) => (
            <p key={line} className="truncate">
              {line}
            </p>
          ))}

          {orgLines.websiteHref ? (
            <p className="truncate">
              <a
                href={orgLines.websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
              >
                {orgLines.websiteLabel}
              </a>
            </p>
          ) : null}

          {orgLines.email ? (
            <p className="truncate">
              <a
                href={`mailto:${orgLines.email}`}
                className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
              >
                {orgLines.email}
              </a>
            </p>
          ) : null}

          {orgLines.swish ? <p className="truncate">Swish {orgLines.swish}</p> : null}
        </div>
      ) : null}

      <div className="pt-2">
        <RoundIconLabelButton
          icon={LogOut}
          label={t('rightSidebar.logOut', { defaultValue: 'Log out' })}
          variant="dangerSoft"
          size="xs"
          alwaysExpanded
          onClick={handleLogout}
        />
      </div>
    </div>
  );
}
