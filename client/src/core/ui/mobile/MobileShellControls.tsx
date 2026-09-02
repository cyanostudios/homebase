import { Menu } from 'lucide-react';
import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { MobileUserMenu } from '@/core/ui/mobile/MobileUserMenu';
import { MOBILE_FLOATING_CHROME_CLASS } from '@/core/ui/pluginPageStyles';
import { cn } from '@/lib/utils';

type MobileShellControlsProps = {
  mobileNavOpen: boolean;
  onOpenMobileNav: () => void;
  onOpenSettings: () => void;
};

export const MobileShellControls = React.memo(function MobileShellControls({
  mobileNavOpen,
  onOpenMobileNav,
  onOpenSettings,
}: MobileShellControlsProps) {
  const { t } = useTranslation();

  const handleOpenNav = useCallback(() => {
    onOpenMobileNav();
  }, [onOpenMobileNav]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-40 lg:hidden">
      {!mobileNavOpen ? (
        <div
          className={cn(
            'pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))]',
            MOBILE_FLOATING_CHROME_CLASS,
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleOpenNav}
            aria-label={t('nav.openNavigation', { defaultValue: 'Open navigation' })}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          'pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex items-center p-1',
          MOBILE_FLOATING_CHROME_CLASS,
        )}
      >
        <MobileUserMenu onOpenSettings={onOpenSettings} />
      </div>
    </div>,
    document.body,
  );
});
