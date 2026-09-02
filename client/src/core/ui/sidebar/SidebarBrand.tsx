import React from 'react';

import { useApp } from '@/core/api/AppContext';
import { cn } from '@/lib/utils';

type SidebarBrandProps = {
  className?: string;
  /** Icon/logo only — used when the desktop left sidebar is collapsed. */
  collapsed?: boolean;
};

export const SidebarBrand = React.memo(function SidebarBrand({
  className,
  collapsed = false,
}: SidebarBrandProps) {
  const { organizationName, organizationLogoUrl } = useApp();

  const brandName = organizationName.trim() || 'Homebase';
  const brandInitial = (brandName.charAt(0) || 'H').toUpperCase();

  // Expanded: `px-6` aligns logo with category icon column. Collapsed: center in rail.
  return (
    <div
      className={cn(
        'flex h-14 w-full shrink-0 items-center gap-2.5',
        collapsed ? 'justify-center px-2' : 'px-6',
        className,
      )}
      title={brandName}
    >
      {organizationLogoUrl ? (
        <img src={organizationLogoUrl} alt="" className="h-9 w-9 shrink-0 object-contain" />
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center text-base font-bold text-foreground"
          aria-hidden
        >
          {brandInitial}
        </span>
      )}
      {!collapsed ? <span className="min-w-0 truncate text-sm font-bold">{brandName}</span> : null}
    </div>
  );
});
